/// User agents.
///
/// This is the least glamorous file in the app and the one that decides whether
/// a streaming site plays at all. Two facts drive it:
///
/// 1. A WKWebView's default user agent has no `Safari/...` token, and an
///    Android WebView's has `; wv` in it. Both mean "embedded browser" to a
///    site's browser sniff, and several streaming services answer that with a
///    "use the app" page instead of a player. Brave and Chrome on the same
///    phones do not have that token, which is a large part of why a site can
///    work there and not here.
/// 2. The engine underneath is the same either way. On iOS this is WebKit, the
///    engine Safari uses, so advertising a Safari build is accurate, not a
///    spoof. On Android it is Chromium, and the token that gives it away is the
///    `wv` marker, not the engine name.
///
/// Nothing here claims to be a different engine. It stops the app describing
/// itself as an embedded browser when it renders exactly like the system one.
class UserAgents {
  UserAgents._();

  static const String appToken = 'Husk/0.1';

  /// iPhone or iPad, mobile web. Matches the shape Safari sends on iOS 17/18,
  /// then appends the app token the way Brave appends its own.
  static const String iosMobile =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
      'AppleWebKit/605.1.15 (KHTML, like Gecko) '
      'Version/18.0 Mobile/15E148 Safari/604.1 Husk/0.1';

  /// iPhone or iPad asking for the desktop site. Some services gate playback on
  /// a desktop browser at all, and this is the honest version of a site's own
  /// "request desktop website" switch.
  static const String iosDesktop =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/605.1.15 (KHTML, like Gecko) '
      'Version/18.0 Safari/605.1.15 Husk/0.1';

  /// Android WebView, with the `wv` marker and the `Version/4.0` artefact
  /// removed so it reads like Chrome for Android.
  static const String androidMobile =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) '
      'AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/126.0.0.0 Mobile Safari/537.36 Husk/0.1';

  static const String androidDesktop =
      'Mozilla/5.0 (X11; Linux x86_64) '
      'AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/126.0.0.0 Safari/537.36 Husk/0.1';

  /// The string a tab should use.
  static String forTab({required bool isIOS, required bool desktop}) {
    if (isIOS) {
      return desktop ? iosDesktop : iosMobile;
    }
    return desktop ? androidDesktop : androidMobile;
  }

  /// True when the user agent still carries the embedded browser marker. Used by
  /// a test, and by the settings screen so the reason is visible if it regresses.
  static bool looksEmbedded(String userAgent) {
    final lower = userAgent.toLowerCase();
    return lower.contains('; wv') || lower.contains('version/4.0') || !lower.contains('safari/');
  }
}
