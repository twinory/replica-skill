import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import 'blocklist.dart';

/// Turning parsed rules into the one thing both platforms understand: a list of
/// content blockers. iOS compiles these into a WKContentRuleList before the
/// first request, Android feeds them to its own content blocker, so a blocked
/// request is never sent and never rendered.
class BlockerBuilder {
  BlockerBuilder._();

  /// Content rule lists are compiled on iOS. Keep this well under the point
  /// where compile time becomes visible, and put exceptions last so they are
  /// never the part that gets cut.
  static const int maxRules = 2000;

  static List<ContentBlocker> build(BlockList list, {required bool enabled}) {
    if (!enabled || list.network.isEmpty) {
      return const <ContentBlocker>[];
    }

    final blocks = <ContentBlocker>[];
    final exceptions = <ContentBlocker>[];

    for (final rule in list.network) {
      final trigger = ContentBlockerTrigger(
        urlFilter: rule.regex,
        resourceType: _types(rule.types),
        ifDomain: rule.ifDomains,
        unlessDomain: rule.unlessDomains,
        loadType: _loadType(rule.loadType),
      );
      if (rule.isException) {
        exceptions.add(ContentBlocker(
          trigger: trigger,
          action: ContentBlockerAction(type: ContentBlockerActionType.IGNORE_PREVIOUS_RULES),
        ));
      } else {
        if (blocks.length >= maxRules - exceptions.length) {
          continue;
        }
        blocks.add(ContentBlocker(
          trigger: trigger,
          action: ContentBlockerAction(type: ContentBlockerActionType.BLOCK),
        ));
      }
    }

    return <ContentBlocker>[...blocks, ...exceptions];
  }

  static List<ContentBlockerTriggerResourceType> _types(Set<String> types) {
    if (types.isEmpty) {
      return const <ContentBlockerTriggerResourceType>[];
    }
    final out = <ContentBlockerTriggerResourceType>[];
    void add(String key, ContentBlockerTriggerResourceType value) {
      if (types.contains(key) && !out.contains(value)) {
        out.add(value);
      }
    }

    add('script', ContentBlockerTriggerResourceType.SCRIPT);
    add('image', ContentBlockerTriggerResourceType.IMAGE);
    add('stylesheet', ContentBlockerTriggerResourceType.STYLE_SHEET);
    add('css', ContentBlockerTriggerResourceType.STYLE_SHEET);
    add('font', ContentBlockerTriggerResourceType.FONT);
    add('media', ContentBlockerTriggerResourceType.MEDIA);
    add('document', ContentBlockerTriggerResourceType.DOCUMENT);
    add('subdocument', ContentBlockerTriggerResourceType.DOCUMENT);
    add('xmlhttprequest', ContentBlockerTriggerResourceType.RAW);
    add('xhr', ContentBlockerTriggerResourceType.RAW);
    add('websocket', ContentBlockerTriggerResourceType.RAW);
    add('ping', ContentBlockerTriggerResourceType.RAW);
    add('other', ContentBlockerTriggerResourceType.RAW);
    add('object', ContentBlockerTriggerResourceType.RAW);
    return out;
  }

  static List<ContentBlockerTriggerLoadType> _loadType(String? loadType) {
    if (loadType == 'third-party') {
      return const <ContentBlockerTriggerLoadType>[
        ContentBlockerTriggerLoadType.THIRD_PARTY,
      ];
    }
    if (loadType == 'first-party') {
      return const <ContentBlockerTriggerLoadType>[
        ContentBlockerTriggerLoadType.FIRST_PARTY,
      ];
    }
    return const <ContentBlockerTriggerLoadType>[];
  }
}
