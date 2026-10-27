import 'dart:convert';

/// A network rule, already converted to the regular expression a content
/// blocker wants. Pure data: this file has no plugin imports so it can be
/// tested without a device.
class NetworkRule {
  const NetworkRule({
    required this.regex,
    required this.isException,
    this.types = const <String>{},
    this.ifDomains = const <String>[],
    this.unlessDomains = const <String>[],
    this.loadType,
    this.category = 'ads',
    required this.source,
  });

  /// Regular expression matched against the full request URL.
  final String regex;
  final bool isException;

  /// Empty means every resource type.
  final Set<String> types;
  final List<String> ifDomains;
  final List<String> unlessDomains;

  /// 'third-party' or 'first-party', null for both.
  final String? loadType;

  /// Section the rule was listed under in the filter file: ads, trackers or
  /// allow. Used so the tracker switch can be turned off on its own.
  final String category;

  /// The line it came from, kept for the broken-site report.
  final String source;
}

/// A rule that hides an element instead of blocking a request.
class CosmeticRule {
  const CosmeticRule({
    required this.selector,
    required this.hide,
    this.host,
    required this.source,
  });

  final String selector;

  /// False for an `#@#` exception, which re-shows an element.
  final bool hide;

  /// Null means every site.
  final String? host;
  final String source;
}

class BlockList {
  const BlockList({
    this.network = const <NetworkRule>[],
    this.cosmetic = const <CosmeticRule>[],
    this.skipped = 0,
    this.label = 'none',
  });

  final List<NetworkRule> network;
  final List<CosmeticRule> cosmetic;

  /// Lines the parser could not express in a content blocker, counted so the
  /// UI can be honest about coverage instead of pretending it is complete.
  final int skipped;
  final String label;

  static const BlockList empty = BlockList();

  int get blockRules => network.where((r) => !r.isException).length;
  int get exceptionRules => network.where((r) => r.isException).length;
  int get globalSelectors => cosmetic.where((r) => r.host == null && r.hide).length;

  /// Every selector that should be hidden on [host], with `#@#` exceptions
  /// removed. Order is stable, duplicates dropped.
  List<String> selectorsFor(String host) {
    final hidden = <String>[];
    final shown = <String>{};
    final h = host.toLowerCase();
    for (final rule in cosmetic) {
      if (!rule.hide) {
        shown.add(rule.selector);
        continue;
      }
      if (rule.host == null || _hostMatches(h, rule.host!)) {
        hidden.add(rule.selector);
      }
    }
    final seen = <String>{};
    final out = <String>[];
    for (final selector in hidden) {
      if (shown.contains(selector) || !seen.add(selector)) {
        continue;
      }
      out.add(selector);
    }
    return out;
  }

  static bool _hostMatches(String host, String pattern) {
    final p = pattern.toLowerCase();
    return host == p || host.endsWith('.$p');
  }

  factory BlockList.decode(String text) => BlockListParser.parse(text, label: 'remote');

  /// A copy with only the given rule categories, keeping every exception so
  /// turning a category off never makes a site break in a new way.
  BlockList filterCategories(Set<String> allowed) {
    if (allowed.contains('ads') && allowed.contains('trackers')) {
      return this;
    }
    final kept = <NetworkRule>[];
    for (final rule in network) {
      if (rule.isException || rule.category == 'allow' || allowed.contains(rule.category)) {
        kept.add(rule);
      }
    }
    return BlockList(
      network: kept,
      cosmetic: cosmetic,
      skipped: skipped,
      label: label,
    );
  }

  String get summary => jsonEncode(<String, dynamic>{
        'label': label,
        'network': network.length,
        'cosmetic': cosmetic.length,
        'skipped': skipped,
      });
}

/// Parses the subset of Adblock Plus syntax documented at the top of
/// `assets/filters/base.txt`. Anything outside that subset is skipped and
/// counted, never silently guessed at.
class BlockListParser {
  BlockListParser._();

  static final RegExp _regexRule = RegExp(r'^/[^/]+/$');

  static BlockList parse(String text, {String label = 'bundled'}) {
    final network = <NetworkRule>[];
    final cosmetic = <CosmeticRule>[];
    var skipped = 0;
    var category = 'ads';

    for (final rawLine in const LineSplitter().convert(text)) {
      final line = rawLine.trim();
      if (line.startsWith('!# category:')) {
        final next = line.substring(13).trim().toLowerCase();
        if (next.isNotEmpty) {
          category = next;
        }
        continue;
      }
      if (line.isEmpty || line.startsWith('!') || line.startsWith('[')) {
        continue;
      }
      if (line.contains('#@#')) {
        final at = line.indexOf('#@#');
        final hosts = _hostsOf(line.substring(0, at));
        final selector = line.substring(at + 3).trim();
        if (hosts == null || selector.isEmpty) {
          skipped++;
          continue;
        }
        for (final host in hosts) {
          cosmetic.add(CosmeticRule(
            selector: selector,
            hide: false,
            host: host,
            source: line,
          ));
        }
        continue;
      }
      if (line.contains('##')) {
        final at = line.indexOf('##');
        final hosts = _hostsOf(line.substring(0, at));
        final selector = line.substring(at + 2).trim();
        if (hosts == null || selector.isEmpty || selector.startsWith('+js(')) {
          skipped++;
          continue;
        }
        for (final host in hosts) {
          cosmetic.add(CosmeticRule(
            selector: selector,
            hide: true,
            host: host,
            source: line,
          ));
        }
        continue;
      }
      if (line.contains('#?#') || line.contains('#\$#')) {
        // Element replacement and snippet rules have no equivalent here.
        skipped++;
        continue;
      }
      final rule = _networkRule(line, category);
      if (rule == null) {
        skipped++;
      } else {
        network.add(rule);
      }
    }

    return BlockList(
      network: network,
      cosmetic: cosmetic,
      skipped: skipped,
      label: label,
    );
  }

  /// Null means "every site". Returns null as well when the host part uses
  /// negation, which this app cannot express.
  static List<String?>? _hostsOf(String raw) {
    final hostPart = raw.trim();
    if (hostPart.isEmpty) {
      return <String?>[null];
    }
    final parts = hostPart.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty);
    final out = <String?>[];
    for (final part in parts) {
      if (part.contains('~') || part.contains('/') || part.contains('*')) {
        return null;
      }
      out.add(part.toLowerCase());
    }
    return out.isEmpty ? <String?>[null] : out;
  }

  static NetworkRule? _networkRule(String line, String category) {
    var body = line;
    var isException = false;
    if (body.startsWith('@@')) {
      isException = true;
      body = body.substring(2);
    }
    if (body.isEmpty) {
      return null;
    }

    var pattern = body;
    var options = '';
    // Options live after a `$` that is not inside a /regex/ rule.
    if (body.startsWith('/') && _regexRule.hasMatch(body)) {
      pattern = body;
    } else {
      final dollar = body.indexOf(r'$');
      if (dollar > 0) {
        pattern = body.substring(0, dollar);
        options = body.substring(dollar + 1);
      }
    }

    final parsedOptions = _options(options);
    if (parsedOptions == null) {
      return null;
    }

    final regex = _toRegex(pattern);
    if (regex == null) {
      return null;
    }
    return NetworkRule(
      regex: regex,
      isException: isException,
      types: parsedOptions.types,
      ifDomains: parsedOptions.ifDomains,
      unlessDomains: parsedOptions.unlessDomains,
      loadType: parsedOptions.loadType,
      category: category,
      source: line,
    );
  }

  static _Options? _options(String raw) {
    if (raw.trim().isEmpty) {
      return const _Options();
    }
    final types = <String>{};
    final ifDomains = <String>[];
    final unlessDomains = <String>[];
    String? loadType;

    for (final token in raw.split(',')) {
      final option = token.trim().toLowerCase();
      if (option.isEmpty) {
        continue;
      }
      if (option.startsWith('domain=')) {
        for (final domain in option.substring(7).split('|')) {
          final d = domain.trim();
          if (d.isEmpty) {
            continue;
          }
          if (d.startsWith('~')) {
            unlessDomains.add(d.substring(1));
          } else {
            ifDomains.add(d);
          }
        }
        continue;
      }
      if (option == 'third-party' || option == '3p') {
        loadType = 'third-party';
        continue;
      }
      if (option == 'first-party' || option == '1p') {
        loadType = 'first-party';
        continue;
      }
      if (option.startsWith('~')) {
        // A negated type cannot be expressed as an allow list, so match all
        // types rather than risk blocking something the filter meant to keep.
        continue;
      }
      const knownTypes = <String>{
        'script', 'image', 'stylesheet', 'css', 'font', 'media', 'object',
        'xmlhttprequest', 'xhr', 'subdocument', 'document', 'other', 'ping',
        'websocket', 'popup',
      };
      if (knownTypes.contains(option)) {
        types.add(option);
        continue;
      }
      // Unknown option: ignore it rather than drop a filter that may matter.
    }
    return _Options(
      types: types,
      ifDomains: ifDomains,
      unlessDomains: unlessDomains,
      loadType: loadType,
    );
  }

  /// Adblock patterns to a regular expression understood by the content
  /// blocker. Returns null when the pattern is not something this parser can
  /// translate.
  static String? _toRegex(String pattern) {
    if (pattern.isEmpty) {
      return null;
    }
    if (pattern.startsWith('/') && pattern.endsWith('/') && pattern.length > 2) {
      return pattern.substring(1, pattern.length - 1);
    }

    final out = StringBuffer();
    var start = 0;
    if (pattern.startsWith('||')) {
      out.write(r'^[a-z][a-z0-9+.\-]*://([^/?#]+\.)?');
      start = 2;
    } else if (pattern.startsWith('|')) {
      out.write('^');
      start = 1;
    }

    final end = pattern.endsWith('|') ? pattern.length - 1 : pattern.length;
    if (start >= end) {
      return null;
    }

    for (var i = start; i < end; i++) {
      final ch = pattern[i];
      switch (ch) {
        case '*':
          out.write('.*');
          break;
        case '^':
          out.write(r'([^a-zA-Z0-9_\-.%]|$)');
          break;
        case '.':
        case '+':
        case '?':
        case '(':
        case ')':
        case '[':
        case ']':
        case '{':
        case '}':
        case r'\':
        case r'$':
          out.write(r'\');
          out.write(ch);
          break;
        default:
          out.write(ch);
      }
    }
    if (pattern.endsWith('|')) {
      out.write(r'$');
    }
    return out.toString();
  }
}

class _Options {
  const _Options({
    this.types = const <String>{},
    this.ifDomains = const <String>[],
    this.unlessDomains = const <String>[],
    this.loadType,
  });

  final Set<String> types;
  final List<String> ifDomains;
  final List<String> unlessDomains;
  final String? loadType;
}
