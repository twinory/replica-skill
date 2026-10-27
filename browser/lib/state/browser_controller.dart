import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import '../core/blockers.dart';
import '../core/blocklist.dart';
import '../core/inject.dart';
import '../core/picker.dart';
import '../core/playback_probe.dart';
import '../core/store.dart';
import '../core/updates.dart';
import '../core/url_rules.dart';
import '../models/settings.dart';
import '../models/site.dart';
import '../models/tab.dart';

class HistoryEntry {
  const HistoryEntry({required this.url, required this.title, required this.at});

  final String url;
  final String title;
  final DateTime at;

  String get host => UrlRules.siteKeyOf(url);

  Map<String, String> toJson() => <String, String>{
        'url': url,
        'title': title,
        'at': at.toIso8601String(),
      };

  factory HistoryEntry.fromJson(Map<String, dynamic> json) => HistoryEntry(
        url: json['url'] as String? ?? '',
        title: json['title'] as String? ?? '',
        at: DateTime.tryParse(json['at'] as String? ?? '') ?? DateTime.now(),
      );
}

/// The whole browser in one object: tabs, settings, filters, patches.
///
/// Web view controllers are held here so a tab survives being switched away
/// from. Widgets never own state that has to outlive them.
class BrowserController extends ChangeNotifier {
  BrowserController(this._store);

  final Store _store;

  Settings settings = const Settings();
  PatchBook patches = PatchBook.empty;
  BlockList blockList = BlockList.empty;

  final List<TabModel> tabs = <TabModel>[];
  final List<HistoryEntry> history = <HistoryEntry>[];
  final Set<String> shieldsOff = <String>{};
  final Set<String> appHosts = <String>{};
  final Set<String> desktopHosts = <String>{};
  final Map<String, List<String>> customHides = <String, List<String>>{};

  final Map<String, InAppWebViewController> _views = <String, InAppWebViewController>{};
  final Set<String> _fullscreen = <String>{};

  String? activeId;
  bool showingHome = true;
  bool ready = false;
  String statusNote = '';
  String? pageBackground;

  int _counter = 0;
  BlockList? _effectiveCache;

  TabModel? get active {
    final id = activeId;
    if (id == null) {
      return null;
    }
    return tabById(id);
  }

  TabModel? tabById(String id) {
    for (final tab in tabs) {
      if (tab.id == id) {
        return tab;
      }
    }
    return null;
  }

  SitePatch? patchFor(String? url) => patches.forHost(UrlRules.hostOf(url));

  SitePatch? get activePatch => patchFor(active?.url);

  bool isFullscreen(String tabId) => _fullscreen.contains(tabId);

  bool get hasTabs => tabs.isNotEmpty;

  int get blockedRuleCount => blockList.blockRules;

  int get hiddenSelectorCount => blockList.globalSelectors;

  // ---------------------------------------------------------------- lifecycle

  Future<void> init() async {
    settings = _store.readSettings();
    shieldsOff.addAll(_store.readShieldsOff());
    appHosts.addAll(_store.readAppHosts());
    customHides.addAll(_store.readHides());
    desktopHosts.addAll(_store.readDesktopHosts());
    for (final raw in _store.readHistory()) {
      history.add(HistoryEntry.fromJson(raw));
    }
    await _loadLists();
    final restored = _store.readTabs();
    for (final tab in restored) {
      tab.shieldsOn = !shieldsOff.contains(UrlRules.siteKeyOf(tab.url));
      tabs.add(tab);
    }
    if (tabs.isNotEmpty) {
      activeId = tabs.first.id;
      showingHome = false;
    }
    ready = true;
    notifyListeners();
    unawaited(refreshRemote());
  }

  Future<void> _loadLists() async {
    String filtersText;
    final cached = _store.readFiltersCache();
    if (cached != null && cached.isNotEmpty) {
      filtersText = cached;
    } else {
      filtersText = await rootBundle.loadString('assets/filters/base.txt');
    }
    blockList = BlockListParser.parse(filtersText, label: cached == null ? 'bundled' : 'cached');
    _effectiveCache = null;

    final cachedPatches = _store.readPatchesCache();
    try {
      patches = PatchBook.decode(
        (cachedPatches != null && cachedPatches.isNotEmpty)
            ? cachedPatches
            : await rootBundle.loadString('assets/patches/sites.json'),
      );
    } catch (_) {
      patches = PatchBook.decode(await rootBundle.loadString('assets/patches/sites.json'));
    }
  }

  /// Pulls newer lists. Failure is silent and leaves the old ones in place.
  Future<void> refreshRemote() async {
    if (!settings.remoteUpdates) {
      return;
    }
    final service = UpdateService.create();
    try {
      final result = await service.refresh(
        currentPatches: patches,
        currentFilterRules: blockList.blockRules,
      );
      var changed = false;
      if (result.patches != null && result.patches!.version > patches.version) {
        patches = result.patches!;
        await _store.writePatchesCache(patches.encode());
        changed = true;
      }
      if (result.filtersText != null && result.filtersText!.isNotEmpty) {
        blockList = BlockListParser.parse(result.filtersText!, label: 'remote');
        _effectiveCache = null;
        await _store.writeFiltersCache(result.filtersText!);
        changed = true;
      }
      statusNote = result.note.isEmpty ? 'Up to date' : result.note;
      if (changed) {
        notifyListeners();
      }
    } finally {
      service.close();
    }
  }

  // ------------------------------------------------------------------- tabs

  String _newId() {
    _counter++;
    return '${DateTime.now().microsecondsSinceEpoch}-$_counter';
  }

  TabModel? openTab(String input, {bool? appMode}) {
    final url = UrlRules.toUrl(input, searchTemplate: settings.searchTemplate);
    if (url == null) {
      return null;
    }
    return openUrl(url, appMode: appMode);
  }

  TabModel openUrl(String url, {bool? appMode}) {
    final site = UrlRules.siteKeyOf(url);
    final patch = patchFor(url);
    final wantsApp = appMode ?? (settings.rememberAppMode && appHosts.contains(site) && patch != null);
    final tab = TabModel(
      id: _newId(),
      url: url,
      appMode: wantsApp,
      shieldsOn: !shieldsOff.contains(site),
      desktopMode: desktopHosts.contains(site) || (patch?.desktopMode ?? false),
    );
    tabs.add(tab);
    activeId = tab.id;
    showingHome = false;
    _persistTabs();
    notifyListeners();
    return tab;
  }

  void closeTab(String id) {
    tabs.removeWhere((t) => t.id == id);
    _views.remove(id);
    _fullscreen.remove(id);
    if (activeId == id) {
      activeId = tabs.isEmpty ? null : tabs.last.id;
      showingHome = tabs.isEmpty;
    }
    _persistTabs();
    notifyListeners();
  }

  void activateTab(String id) {
    activeId = id;
    showingHome = false;
    notifyListeners();
  }

  void goHome() {
    showingHome = true;
    notifyListeners();
  }

  void closeAllTabs() {
    tabs.clear();
    _views.clear();
    activeId = null;
    showingHome = true;
    _persistTabs();
    notifyListeners();
  }

  void attach(String tabId, InAppWebViewController controller) {
    _views[tabId] = controller;
  }

  Future<void> navigate(String tabId, String input) async {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    final url = UrlRules.toUrl(input, searchTemplate: settings.searchTemplate);
    if (url == null) {
      return;
    }
    if (url == tab.url) {
      await _views[tabId]?.reload();
      return;
    }
    tab.url = url;
    tab.appMode = settings.rememberAppMode && appHosts.contains(UrlRules.siteKeyOf(url));
    tab.shieldsOn = !shieldsOff.contains(UrlRules.siteKeyOf(url));
    tab.failed = false;
    notifyListeners();
    await _views[tabId]?.loadUrl(urlRequest: URLRequest(url: WebUri(url)));
    _persistTabs();
  }

  Future<void> reload(String tabId) async {
    await _views[tabId]?.reload();
  }

  Future<void> goBack(String tabId) async {
    await _views[tabId]?.goBack();
  }

  Future<void> goForward(String tabId) async {
    await _views[tabId]?.goForward();
  }

  Future<void> stopLoading(String tabId) async {
    await _views[tabId]?.stopLoading();
  }

  void onLoadStart(String tabId, String? url) {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    if (url != null && url.isNotEmpty && UrlRules.isHttp(url)) {
      tab.url = url;
    }
    tab.isLoading = true;
    tab.progress = 0;
    tab.failed = false;
    tab.shieldsOn = !shieldsOff.contains(UrlRules.siteKeyOf(tab.url));
    _syncChrome(tabId);
    notifyListeners();
  }

  void onProgress(String tabId, int progress) {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    tab.progress = (progress / 100).clamp(0.0, 1.0);
    tab.isLoading = progress < 100;
    notifyListeners();
  }

  void onTitle(String tabId, String? title) {
    final tab = tabById(tabId);
    if (tab == null || title == null) {
      return;
    }
    tab.title = title;
    _persistTabs();
    notifyListeners();
  }

  void onVisited(String tabId, String? url, bool canBack, bool canForward) {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    if (url != null && UrlRules.isHttp(url)) {
      tab.url = url;
    }
    tab.canGoBack = canBack;
    tab.canGoForward = canForward;
    tab.shieldsOn = !shieldsOff.contains(UrlRules.siteKeyOf(tab.url));
    _persistTabs();
    notifyListeners();
  }

  void onLoadStop(String tabId, String? url) async {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    tab.isLoading = false;
    tab.progress = 1;
    if (url != null && UrlRules.isHttp(url) && url != 'about:blank') {
      tab.url = url;
      _remember(tab);
    }
    _syncChrome(tabId);
    notifyListeners();
    final view = _views[tabId];
    if (view != null) {
      if (tab.appMode) {
        await view.evaluateJavascript(
          source: Injector.appModeScript(patchFor(tab.url), enabled: true),
        );
      }
      try {
        final value = await view.evaluateJavascript(source: Injector.pageBackgroundScript);
        if (value is String && value.isNotEmpty) {
          pageBackground = value;
          notifyListeners();
        }
      } catch (_) {
        // Reading a colour is a nicety, never a reason to show an error.
      }
    }
  }

  void onLoadError(String tabId) {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    tab.isLoading = false;
    tab.failed = true;
    notifyListeners();
  }

  void _remember(TabModel tab) {
    if (tab.url.isEmpty || tab.url == 'about:blank') {
      return;
    }
    history.removeWhere((e) => e.url == tab.url);
    history.insert(
      0,
      HistoryEntry(url: tab.url, title: tab.title, at: DateTime.now()),
    );
    while (history.length > 120) {
      history.removeLast();
    }
    _store.writeHistory(history.map((e) => e.toJson()).toList());
  }

  void removeHistory(String url) {
    history.removeWhere((e) => e.url == url);
    _store.writeHistory(history.map((e) => e.toJson()).toList());
    notifyListeners();
  }

  void clearHistory() {
    history.clear();
    _store.writeHistory(const <Map<String, String>>[]);
    notifyListeners();
  }

  // ---------------------------------------------------------------- shields

  BlockList get effectiveList {
    final cached = _effectiveCache;
    if (cached != null) {
      return cached;
    }
    final next = blockList.filterCategories(
      settings.blockTrackers ? const <String>{'ads', 'trackers', 'allow'} : const <String>{'ads', 'allow'},
    );
    _effectiveCache = next;
    return next;
  }

  List<ContentBlocker> blockersFor(TabModel tab) => BlockerBuilder.build(
        effectiveList,
        enabled: tab.shieldsOn && settings.anyShields,
      );

  List<UserScript> scriptsFor(TabModel tab) {
    final scripts = <UserScript>[
      UserScript(
        source: Injector.bootstrapScript(),
        injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
        forMainFrameOnly: true,
      ),
    ];
    final custom = hidesFor(tab.url);
    if (custom.isNotEmpty || (tab.shieldsOn && settings.hideCosmetic)) {
      final css = Injector.cosmeticCss(
        tab.shieldsOn && settings.hideCosmetic ? effectiveList : BlockList.empty,
        UrlRules.hostOf(tab.url),
        custom: custom,
      );
      if (css.isNotEmpty) {
        scripts.add(UserScript(
          source: "(function(){try{var s=document.createElement('style');"
              "s.id='husk-cosmetic';s.textContent=${jsonEncode(css)};"
              "(document.head||document.documentElement).appendChild(s);}catch(e){}})();",
          injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
          forMainFrameOnly: false,
        ));
      }
    }
    scripts.add(UserScript(
      source: PlaybackProbe.script,
      injectionTime: UserScriptInjectionTime.AT_DOCUMENT_END,
      forMainFrameOnly: true,
    ));
    if (tab.shieldsOn) {
      final player = Injector.playerScript(patchFor(tab.url));
      if (player.isNotEmpty) {
        scripts.add(UserScript(
          source: player,
          injectionTime: UserScriptInjectionTime.AT_DOCUMENT_END,
          forMainFrameOnly: true,
        ));
      }
    }
    return scripts;
  }

  /// Rebuilds the whole tab so new filter lists and user scripts really apply.
  /// A content blocker rule list can be swapped in place, user scripts cannot.
  Future<void> applyShieldsChange(String tabId) async {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    tab.generation++;
    tab.shieldsOn = !shieldsOff.contains(UrlRules.siteKeyOf(tab.url));
    notifyListeners();
    _persistTabs();
  }

  Future<void> toggleSiteShields(String tabId) async {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    final site = UrlRules.siteKeyOf(tab.url);
    if (site.isEmpty) {
      return;
    }
    if (shieldsOff.contains(site)) {
      shieldsOff.remove(site);
    } else {
      shieldsOff.add(site);
    }
    await _store.writeShieldsOff(shieldsOff);
    await applyShieldsChange(tabId);
  }

  Future<void> resetAllowedSites() async {
    shieldsOff.clear();
    await _store.writeShieldsOff(shieldsOff);
    for (final tab in List<TabModel>.of(tabs)) {
      await applyShieldsChange(tab.id);
    }
    notifyListeners();
  }

  Future<void> setSettings(Settings next) async {
    settings = next;
    _effectiveCache = null;
    await _store.writeSettings(next);
    notifyListeners();
  }

  // --------------------------------------------------------------- picking

  List<String> hidesFor(String url) {
    final site = UrlRules.siteKeyOf(url);
    return customHides[site] ?? const <String>[];
  }

  int get customHideCount =>
      customHides.values.fold(0, (int sum, List<String> list) => sum + list.length);

  int get customHideSites => customHides.keys.length;

  /// Turns the page into a picker. The script reports one selector back and
  /// puts everything it changed back, whether or not the person picks.
  Future<void> startPicker(String tabId) async {
    final view = _views[tabId];
    if (view == null) {
      return;
    }
    await view.evaluateJavascript(source: Picker.script());
  }

  Future<void> addCustomHide(String tabId, String selector) async {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    final clean = selector.trim();
    if (clean.isEmpty || clean.length > 300 || clean.contains('{') || clean.contains('}')) {
      return;
    }
    final site = UrlRules.siteKeyOf(tab.url);
    if (site.isEmpty) {
      return;
    }
    final list = customHides.putIfAbsent(site, () => <String>[]);
    if (!list.contains(clean)) {
      list.add(clean);
    }
    await _store.writeHides(customHides);
    // Apply now, so the thing disappears under the person's finger.
    final css = list.map((String rule) => '$rule{display:none!important}').join('\n');
    await _views[tabId]?.evaluateJavascript(source: '''
(function(){try{
  var id='husk-picked';
  var style=document.getElementById(id);
  if(!style){style=document.createElement('style');style.id=id;
    (document.head||document.documentElement).appendChild(style);}
  style.textContent=${jsonEncode(css)};
  return true;
}catch(e){return false;}})();
''');
    notifyListeners();
  }

  Future<void> clearCustomHides(String tabId) async {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    final site = UrlRules.siteKeyOf(tab.url);
    customHides.remove(site);
    await _store.writeHides(customHides);
    await applyShieldsChange(tabId);
  }

  Future<void> clearAllCustomHides() async {
    customHides.clear();
    await _store.writeHides(customHides);
    for (final tab in List<TabModel>.of(tabs)) {
      await applyShieldsChange(tab.id);
    }
    notifyListeners();
  }

  // --------------------------------------------------------------- app mode

  Future<void> setAppMode(String tabId, bool enabled) async {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    final site = UrlRules.siteKeyOf(tab.url);
    tab.appMode = enabled;
    if (site.isNotEmpty && settings.rememberAppMode) {
      if (enabled) {
        appHosts.add(site);
      } else {
        appHosts.remove(site);
      }
      await _store.writeAppHosts(appHosts);
    }
    final view = _views[tabId];
    if (view != null) {
      await view.evaluateJavascript(
        source: Injector.appModeScript(patchFor(tab.url), enabled: enabled),
      );
    }
    notifyListeners();
  }

  /// The probe reports once per page load. Only a real failure is recorded.
  void markPlayback(String tabId, String status, String detail) {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    tab.playbackNote = status == 'blocked' ? (detail.isEmpty ? 'player blocked' : detail) : '';
    notifyListeners();
  }

  bool isDesktop(String url) => desktopHosts.contains(UrlRules.siteKeyOf(url));

  Future<void> setDesktopMode(String tabId, bool enabled) async {
    final tab = tabById(tabId);
    if (tab == null) {
      return;
    }
    final site = UrlRules.siteKeyOf(tab.url);
    tab.desktopMode = enabled;
    if (enabled) {
      desktopHosts.add(site);
    } else {
      desktopHosts.remove(site);
    }
    await _store.writeDesktopHosts(desktopHosts);
    // The user agent is fixed when the web view is built, so rebuild it.
    tab.generation++;
    notifyListeners();
    _persistTabs();
  }

  void setFullscreen(String tabId, bool on) {
    if (on) {
      _fullscreen.add(tabId);
    } else {
      _fullscreen.remove(tabId);
    }
    notifyListeners();
  }

  bool appModeDefaultFor(String url) {
    final site = UrlRules.siteKeyOf(url);
    return settings.rememberAppMode && appHosts.contains(site);
  }

  Future<void> setAppModeDefault(String url, bool on) async {
    final site = UrlRules.siteKeyOf(url);
    if (site.isEmpty) {
      return;
    }
    if (on) {
      appHosts.add(site);
    } else {
      appHosts.remove(site);
    }
    await _store.writeAppHosts(appHosts);
    notifyListeners();
  }

  // ------------------------------------------------------------------- data

  Future<void> clearBrowsingData() async {
    await InAppWebViewController.clearAllCache();
    await CookieManager.instance().deleteAllCookies();
    history.clear();
    tabs.clear();
    _views.clear();
    activeId = null;
    showingHome = true;
    await _store.clearBrowsingData();
    notifyListeners();
  }

  void _syncChrome(String tabId) {
    final view = _views[tabId];
    if (view == null) {
      return;
    }
    unawaited(() async {
      final tab = tabById(tabId);
      if (tab == null) {
        return;
      }
      final back = await view.canGoBack();
      final forward = await view.canGoForward();
      if (back != tab.canGoBack || forward != tab.canGoForward) {
        tab.canGoBack = back;
        tab.canGoForward = forward;
        notifyListeners();
      }
    }());
  }

  void _persistTabs() {
    unawaited(_store.writeTabs(tabs));
  }

  @override
  void dispose() {
    super.dispose();
  }
}
