import 'dart:convert';

/// A site that Veil knows how to promote into an app view.
///
/// Loaded from `assets/patches/sites.json` and optionally replaced by a newer
/// copy fetched from the update endpoint, so App Mode can be repaired without
/// shipping a new binary.
class SitePatch {
  const SitePatch({
    required this.id,
    required this.name,
    required this.hosts,
    required this.start,
    this.featured = false,
    this.icon = 'globe',
    this.color = '#6C7A89',
    this.media = false,
    this.cosmetic = const <String>[],
    this.appHide = const <String>[],
    this.appCss = '',
    this.appJs = '',
    this.playerJs = '',
    this.handoff,
    this.notes = '',
  });

  final String id;
  final String name;
  final List<String> hosts;
  final String start;
  final bool featured;
  final String icon;
  final String color;
  final bool media;
  final List<String> cosmetic;
  final List<String> appHide;
  final String appCss;
  final String appJs;
  final String playerJs;
  final Handoff? handoff;
  final String notes;

  bool matches(String host) {
    final h = host.toLowerCase();
    for (final candidate in hosts) {
      final c = candidate.toLowerCase();
      if (h == c || h.endsWith('.$c')) {
        return true;
      }
    }
    return false;
  }

  factory SitePatch.fromJson(Map<String, dynamic> json) {
    final appMode = (json['appMode'] as Map<String, dynamic>?) ?? const {};
    final player = (json['player'] as Map<String, dynamic>?) ?? const {};
    final handoffJson = json['handoff'] as Map<String, dynamic>?;
    return SitePatch(
      id: json['id'] as String,
      name: json['name'] as String,
      hosts: (json['hosts'] as List<dynamic>).map((e) => e as String).toList(),
      start: json['start'] as String,
      featured: json['featured'] as bool? ?? false,
      icon: json['icon'] as String? ?? 'globe',
      color: json['color'] as String? ?? '#6C7A89',
      media: json['media'] as bool? ?? false,
      cosmetic: (json['cosmetic'] as List<dynamic>? ?? const [])
          .map((e) => e as String)
          .toList(),
      appHide: (appMode['hide'] as List<dynamic>? ?? const [])
          .map((e) => e as String)
          .toList(),
      appCss: appMode['css'] as String? ?? '',
      appJs: appMode['js'] as String? ?? '',
      playerJs: player['js'] as String? ?? '',
      handoff: handoffJson == null ? null : Handoff.fromJson(handoffJson),
      notes: json['notes'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'name': name,
        'hosts': hosts,
        'start': start,
        'featured': featured,
        'icon': icon,
        'color': color,
        'media': media,
        'cosmetic': cosmetic,
        'appMode': <String, dynamic>{'hide': appHide, 'css': appCss, 'js': appJs},
        'player': <String, dynamic>{'js': playerJs},
        if (handoff != null) 'handoff': handoff!.toJson(),
        'notes': notes,
      };
}

/// What to do when a site cannot work inside an embedded browser at all,
/// usually because it streams DRM protected audio or video.
class Handoff {
  const Handoff({
    required this.label,
    required this.ios,
    required this.android,
    required this.storeIos,
    required this.storeAndroid,
    required this.reason,
  });

  final String label;
  final String ios;
  final String android;
  final String storeIos;
  final String storeAndroid;
  final String reason;

  factory Handoff.fromJson(Map<String, dynamic> json) => Handoff(
        label: json['label'] as String? ?? 'Open in the app',
        ios: json['ios'] as String? ?? '',
        android: json['android'] as String? ?? '',
        storeIos: json['storeIos'] as String? ?? '',
        storeAndroid: json['storeAndroid'] as String? ?? '',
        reason: json['reason'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => <String, dynamic>{
        'label': label,
        'ios': ios,
        'android': android,
        'storeIos': storeIos,
        'storeAndroid': storeAndroid,
        'reason': reason,
      };
}

/// The whole patch file.
class PatchBook {
  const PatchBook({required this.version, required this.updated, required this.sites});

  final int version;
  final String updated;
  final List<SitePatch> sites;

  static const PatchBook empty = PatchBook(version: 0, updated: '', sites: <SitePatch>[]);

  factory PatchBook.fromJson(Map<String, dynamic> json) => PatchBook(
        version: json['version'] as int? ?? 0,
        updated: json['updated'] as String? ?? '',
        sites: (json['sites'] as List<dynamic>? ?? const [])
            .map((e) => SitePatch.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  factory PatchBook.decode(String text) =>
      PatchBook.fromJson(jsonDecode(text) as Map<String, dynamic>);

  String encode() => jsonEncode(<String, dynamic>{
        'version': version,
        'updated': updated,
        'sites': sites.map((s) => s.toJson()).toList(),
      });

  List<SitePatch> get featured {
    final out = sites.where((s) => s.featured).toList();
    out.sort((a, b) => a.name.compareTo(b.name));
    return out;
  }

  SitePatch? forHost(String host) {
    for (final site in sites) {
      if (site.matches(host)) {
        return site;
      }
    }
    return null;
  }

  SitePatch? byId(String id) {
    for (final site in sites) {
      if (site.id == id) {
        return site;
      }
    }
    return null;
  }
}
