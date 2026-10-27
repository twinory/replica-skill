import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/settings.dart';
import '../models/tab.dart';

/// Everything that has to survive a cold start. Deliberately dumb: no state
/// lives here that a widget could rebuild from the network.
class Store {
  Store(this._prefs);

  final SharedPreferences _prefs;

  static const String _kSettings = 'veil.settings';
  static const String _kTabs = 'veil.tabs';
  static const String _kHistory = 'veil.history';
  static const String _kShieldsOff = 'veil.shieldsOff';
  static const String _kAppHosts = 'veil.appHosts';
  static const String _kAppTabs = 'veil.appTabs';
  static const String _kPatches = 'veil.patches';
  static const String _kFilters = 'veil.filters';

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

  String? readMeta(String key) => _prefs.getString('veil.meta.$key');
  Future<void> writeMeta(String key, String value) => _prefs.setString('veil.meta.$key', value);

  Future<void> clearBrowsingData() async {
    await _prefs.remove(_kHistory);
    await _prefs.remove(_kTabs);
    await _prefs.remove(_kAppTabs);
  }

  Future<void> clearEverything() => _prefs.clear();
}
