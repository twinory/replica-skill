/// Everything the person using the app can change, in one serialisable object.
class Settings {
  const Settings({
    this.searchTemplate = 'https://duckduckgo.com/?q=%s',
    this.searchName = 'DuckDuckGo',
    this.blockAds = true,
    this.blockTrackers = true,
    this.hideCosmetic = true,
    this.guardRequests = false,
    this.javascriptEnabled = true,
    this.rememberAppMode = true,
    this.remoteUpdates = true,
    this.blockPopups = true,
    this.themeMode = 'system',
  });

  final String searchTemplate;
  final String searchName;
  final bool blockAds;
  final bool blockTrackers;
  final bool hideCosmetic;

  /// Second layer: refuse matching requests outright in the web view client.
  /// Android only. Off by default because request interception in the web view
  /// has a known freeze bug on long browsing sessions.
  final bool guardRequests;
  final bool javascriptEnabled;
  final bool rememberAppMode;
  final bool remoteUpdates;
  final bool blockPopups;
  final String themeMode;

  bool get anyShields => blockAds || blockTrackers || hideCosmetic;

  Settings copyWith({
    String? searchTemplate,
    String? searchName,
    bool? blockAds,
    bool? blockTrackers,
    bool? hideCosmetic,
    bool? guardRequests,
    bool? javascriptEnabled,
    bool? rememberAppMode,
    bool? remoteUpdates,
    bool? blockPopups,
    String? themeMode,
  }) {
    return Settings(
      searchTemplate: searchTemplate ?? this.searchTemplate,
      searchName: searchName ?? this.searchName,
      blockAds: blockAds ?? this.blockAds,
      blockTrackers: blockTrackers ?? this.blockTrackers,
      hideCosmetic: hideCosmetic ?? this.hideCosmetic,
      guardRequests: guardRequests ?? this.guardRequests,
      javascriptEnabled: javascriptEnabled ?? this.javascriptEnabled,
      rememberAppMode: rememberAppMode ?? this.rememberAppMode,
      remoteUpdates: remoteUpdates ?? this.remoteUpdates,
      blockPopups: blockPopups ?? this.blockPopups,
      themeMode: themeMode ?? this.themeMode,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'searchTemplate': searchTemplate,
        'searchName': searchName,
        'blockAds': blockAds,
        'blockTrackers': blockTrackers,
        'hideCosmetic': hideCosmetic,
        'guardRequests': guardRequests,
        'javascriptEnabled': javascriptEnabled,
        'rememberAppMode': rememberAppMode,
        'remoteUpdates': remoteUpdates,
        'blockPopups': blockPopups,
        'themeMode': themeMode,
      };

  factory Settings.fromJson(Map<String, dynamic> json) => Settings(
        searchTemplate: json['searchTemplate'] as String? ?? 'https://duckduckgo.com/?q=%s',
        searchName: json['searchName'] as String? ?? 'DuckDuckGo',
        blockAds: json['blockAds'] as bool? ?? true,
        blockTrackers: json['blockTrackers'] as bool? ?? true,
        hideCosmetic: json['hideCosmetic'] as bool? ?? true,
        guardRequests: json['guardRequests'] as bool? ?? false,
        javascriptEnabled: json['javascriptEnabled'] as bool? ?? true,
        rememberAppMode: json['rememberAppMode'] as bool? ?? true,
        remoteUpdates: json['remoteUpdates'] as bool? ?? true,
        blockPopups: json['blockPopups'] as bool? ?? true,
        themeMode: json['themeMode'] as String? ?? 'system',
      );

  static const List<List<String>> searchEngines = <List<String>>[
    <String>['DuckDuckGo', 'https://duckduckgo.com/?q=%s'],
    <String>['Google', 'https://www.google.com/search?q=%s'],
    <String>['Bing', 'https://www.bing.com/search?q=%s'],
    <String>['Brave', 'https://search.brave.com/search?q=%s'],
    <String>['Startpage', 'https://www.startpage.com/sp/search?query=%s'],
  ];
}
