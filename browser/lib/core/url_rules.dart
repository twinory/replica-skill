/// Turning what a person typed into a URL, and turning a URL into something
/// short enough to show in an address bar.
///
/// Deliberately free of Flutter imports so it can be unit tested with plain
/// `dart test` style assertions.
class UrlRules {
  UrlRules._();

  static const String defaultSearch = 'https://duckduckgo.com/?q=%s';

  static final RegExp _scheme = RegExp(r'^([a-zA-Z][a-zA-Z0-9+.\-]*):');
  static final RegExp _hostish = RegExp(
    r'^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)+(:\d{1,5})?(/.*)?$',
  );
  static final RegExp _ipv4 = RegExp(r'^\d{1,3}(\.\d{1,3}){3}(:\d{1,5})?(/.*)?$');
  static final RegExp _whitespace = RegExp(r'\s');

  /// Suffixes that take two labels, so `example.co.uk` keeps three labels
  /// instead of collapsing to `co.uk`.
  static const List<String> _multiPartSuffixes = <String>[
    'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk',
    'com.au', 'net.au', 'org.au', 'edu.au', 'co.nz', 'net.nz',
    'co.in', 'net.in', 'org.in', 'ac.in', 'gov.in', 'co.jp', 'ne.jp',
    'or.jp', 'co.kr', 'or.kr', 'com.sg', 'com.my', 'com.ph', 'com.pk',
    'com.br', 'com.mx', 'com.ar', 'com.co', 'co.za', 'co.il', 'co.id',
    'com.tr', 'com.cn', 'com.hk', 'com.tw', 'com.ua', 'com.eg', 'com.sa',
    'co.ke', 'co.th', 'com.vn', 'com.np', 'com.bd', 'com.lk',
  ];

  /// Returns a loadable URL, or null when the input is not usable.
  /// Everything that is not clearly a URL becomes a search.
  static String? toUrl(String raw, {String searchTemplate = defaultSearch}) {
    final input = raw.trim();
    if (input.isEmpty) {
      return null;
    }
    if (input == 'about:blank' || input.startsWith('data:') || input.startsWith('javascript:')) {
      return null;
    }

    final scheme = _scheme.firstMatch(input);
    if (scheme != null) {
      final s = scheme.group(1)!.toLowerCase();
      if (s == 'http' || s == 'https') {
        return input;
      }
      if (s == 'localhost') {
        return 'http://$input';
      }
      // mailto:, tel:, intent:, spotify: and friends are for the caller to hand
      // to the operating system, not something a web view should load.
      return null;
    }

    if (_whitespace.hasMatch(input)) {
      return _search(input, searchTemplate);
    }
    if (input.startsWith('localhost') || _ipv4.hasMatch(input)) {
      return 'http://$input';
    }
    if (_hostish.hasMatch(input)) {
      return 'https://$input';
    }
    return _search(input, searchTemplate);
  }

  static String _search(String query, String template) {
    final base = template.contains('%s') ? template : defaultSearch;
    return base.replaceFirst('%s', Uri.encodeQueryComponent(query));
  }

  static Uri? parse(String? url) {
    if (url == null || url.isEmpty) {
      return null;
    }
    return Uri.tryParse(url);
  }

  static bool isHttp(String? url) {
    final uri = parse(url);
    return uri != null && (uri.scheme == 'http' || uri.scheme == 'https');
  }

  /// Host without `www.`, without port, lowercase. Empty when unparseable.
  static String hostOf(String? url) {
    final uri = parse(url);
    if (uri == null || uri.host.isEmpty) {
      return '';
    }
    return uri.host.toLowerCase().replaceFirst(RegExp(r'^www\.'), '');
  }

  /// The part a person thinks of as the site: `news.bbc.co.uk` -> `bbc.co.uk`.
  static String siteKeyOf(String? url) {
    final host = hostOf(url);
    if (host.isEmpty) {
      return '';
    }
    if (_ipv4.hasMatch(host) || !host.contains('.')) {
      return host;
    }
    final labels = host.split('.');
    if (labels.length == 2) {
      return host;
    }
    final lastTwo = labels.sublist(labels.length - 2).join('.');
    if (_multiPartSuffixes.contains(lastTwo) && labels.length >= 3) {
      return labels.sublist(labels.length - 3).join('.');
    }
    return lastTwo;
  }

  /// Text for the address bar: no scheme, no trailing slash, no `www.`.
  static String display(String? url) {
    if (url == null || url.isEmpty) {
      return '';
    }
    var out = url;
    if (out.startsWith('https://')) {
      out = out.substring(8);
    } else if (out.startsWith('http://')) {
      out = out.substring(7);
    }
    if (out.endsWith('/') && out.indexOf('/') == out.length - 1) {
      out = out.substring(0, out.length - 1);
    }
    return out;
  }

  /// Hosts where a login form is refused inside an embedded web view, so the
  /// request has to finish in the system browser instead.
  static const List<String> authHosts = <String>[
    'accounts.google.com',
    'accounts.youtube.com',
    'myaccount.google.com',
    'appleid.apple.com',
    'login.microsoftonline.com',
    'login.live.com',
  ];

  static bool needsSystemBrowser(String? url) {
    final host = hostOf(url);
    if (host.isEmpty) {
      return false;
    }
    for (final auth in authHosts) {
      if (host == auth || host.endsWith('.$auth')) {
        return true;
      }
    }
    return false;
  }

  /// True for links that never load in a web view and must be handed to the OS.
  static bool isExternalScheme(String? url) {
    final uri = parse(url);
    if (uri == null) {
      return false;
    }
    const content = <String>['http', 'https', 'about', 'data', 'blob', 'javascript'];
    return !content.contains(uri.scheme.toLowerCase());
  }
}
