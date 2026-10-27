import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/settings.dart';
import '../models/tab.dart';

/// Everything that has to survive a cold start. Deliberately dumb: no state
/// lives here that a widget could rebuild from the network.
class Store {
  Store(this._prefs);

  final SharedPreferences _prefs;

  static const String _kSettings = 'husk.settings';
  static const String _kTabs = 'husk.tabs';
  static const String _kHistory = 'husk.history';
  static const String _kShieldsOff = 'husk.shieldsOff';
  static const String _kAppHosts = 'husk.appHosts';
  static const String _kAppTabs = 'husk.appTabs';
  static const String _kPatches = 'husk.patches';
  static const String _kFilters = 'husk.filters';
  static const String _kHides = 'husk.hides';

  static Future<Store> open() async => Store(await SharedPreferences.getInstance());

  Settings readSettings() {
    final raw = _prefs.getString(_kSettings);
    if (raw == null || raw.isEmpty) {
      return const Settings();
    }
    try {
      return Settings.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const Settings();
    }
  }

  Future<void> writeSettings(Settings settings) =>
      _prefs.setString(_kSettings, jsonEncode(settings.toJson()));

  List<TabModel> readTabs() {
    final raw = _prefs.getString(_kTabs);
    if (raw == null || raw.isEmpty) {
      return <TabModel>[];
    }
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => TabModel.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return <TabModel>[];
    }
  }

  Future<void> writeTabs(List<TabModel> tabs) =>
      _prefs.setString(_kTabs, jsonEncode(tabs.map((t) => t.toJson()).toList()));

  List<Map<String, String>> readHistory() {
    final raw = _prefs.getString(_kHistory);
    if (raw == null || raw.isEmpty) {
      return <Map<String, String>>[];
    }
    try {
      return (jsonDecode(raw) as List<dynamic>)
          .map((e) => Map<String, String>.from(e as Map))
          .toList();
    } catch (_) {
      return <Map<String, String>>[];
    }
  }

  Future<void> writeHistory(List<Map<String, String>> entries) =>
      _prefs.setString(_kHistory, jsonEncode(entries));

  Set<String> readStringSet(String key) {
    final raw = _prefs.getString(key);
    if (raw == null || raw.isEmpty) {
      return <String>{};
    }
    try {
      return (jsonDecode(raw) as List<dynamic>).map((e) => e as String).toSet();
    } catch (_) {
      return <String>{};
    }
  }

  Future<void> writeStringSet(String key, Set<String> value) =>
      _prefs.setString(key, jsonEncode(value.toList()));

  Set<String> readShieldsOff() => readStringSet(_kShieldsOff);
  Future<void> writeShieldsOff(Set<String> hosts) => writeStringSet(_kShieldsOff, hosts);

  Set<String> readAppHosts() => readStringSet(_kAppHosts);
  Future<void> writeAppHosts(Set<String> hosts) => writeStringSet(_kAppHosts, hosts);

  Set<String> readAppTabs() => readStringSet(_kAppTabs);
  Future<void> writeAppTabs(Set<String> tabs) => writeStringSet(_kAppTabs, tabs);

  String? readPatchesCache() => _prefs.getString(_kPatches);
  Future<void> writePatchesCache(String text) => _prefs.setString(_kPatches, text);

  String? readFiltersCache() => _prefs.getString(_kFilters);
  Future<void> writeFiltersCache(String text) => _prefs.setString(_kFilters, text);

  /// Element picks, keyed by site. A person's own choice, so it survives
  /// filter updates and a reinstall of nothing else.
  Map<String, List<String>> readHides() {
    final raw = _prefs.getString(_kHides);
    if (raw == null || raw.isEmpty) {
      return <String, List<String>>{};
    }
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      final out = <String, List<String>>{};
      decoded.forEach((String key, dynamic value) {
        if (value is List) {
          out[key] = value.map((e) => e.toString()).toList();
        }
      });
      return out;
    } catch (_) {
      return <String, List<String>>{};
    }
  }

  Future<void> writeHides(Map<String, List<String>> hides) =>
      _prefs.setString(_kHides, jsonEncode(hides));

  String? readMeta(String key) => _prefs.getString('husk.meta.$key');
  Future<void> writeMeta(String key, String value) => _prefs.setString('husk.meta.$key', value);

  Future<void> clearBrowsingData() async {
    await _prefs.remove(_kHistory);
    await _prefs.remove(_kTabs);
    await _prefs.remove(_kAppTabs);
  }

  Future<void> clearEverything() => _prefs.clear();
}
