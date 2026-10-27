import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:veil/core/blocklist.dart';

void main() {
  group('Adblock translation', () {
    test('a domain anchor becomes a scheme aware url filter', () {
      final list = BlockListParser.parse('||doubleclick.net^');
      expect(list.network, hasLength(1));
      expect(
        list.network.first.regex,
        r'^[a-z][a-z0-9+.\-]*://([^/?#]+\.)?doubleclick\.net([^a-zA-Z0-9_\-.%]|$)',
      );
    });

    test('an exact url rule is anchored at both ends', () {
      final list = BlockListParser.parse('|https://example.com/ad.js|');
      expect(list.network.first.regex, r'^https://example\.com/ad\.js$');
    });

    test('a regex rule passes through', () {
      final list = BlockListParser.parse(r'/banner[0-9]+/');
      expect(list.network.first.regex, r'banner[0-9]+');
    });

    test('a wildcard becomes a greedy match', () {
      final list = BlockListParser.parse('||ads.example.com/*/banner');
      expect(list.network.first.regex.contains('.*'), isTrue);
    });

    test('exceptions survive and are marked', () {
      final list = BlockListParser.parse('||ads.example.com^\n@@||ads.example.com/allowed^');
      expect(list.blockRules, 1);
      expect(list.exceptionRules, 1);
      expect(list.network.last.isException, isTrue);
    });

    test('options map to resource types and domains', () {
      final list = BlockListParser.parse('||ads.example.com^$script,image,domain=news.example|~old.example');
      final rule = list.network.single;
      expect(rule.types, containsAll(<String>['script', 'image']));
      expect(rule.ifDomains, <String>['news.example']);
      expect(rule.unlessDomains, <String>['old.example']);
    });

    test('third party options are kept as a load type', () {
      final list = BlockListParser.parse('||tracker.example^$third-party');
      expect(list.network.single.loadType, 'third-party');
    });

    test('unsupported syntax is counted, not guessed at', () {
      final list = BlockListParser.parse(
        'example.com#?#.ad:has(.thing)\nexample.com##+js(set, a, b)',
      );
      expect(list.network, isEmpty);
      expect(list.cosmetic, isEmpty);
      expect(list.skipped, 2);
    });
  });

  group('Cosmetic rules', () {
    final list = BlockListParser.parse(<String>[
      '##.global-ad',
      'news.example##.site-ad',
      'news.example#@#.global-ad',
    ].join('\n'));

    test('a global rule applies everywhere', () {
      expect(list.selectorsFor('anything.test'), contains('.global-ad'));
    });

    test('a site rule only applies to that site and its subdomains', () {
      expect(list.selectorsFor('news.example'), contains('.site-ad'));
      expect(list.selectorsFor('m.news.example'), contains('.site-ad'));
      expect(list.selectorsFor('other.example'), isNot(contains('.site-ad')));
    });

    test('an exception re-shows the element', () {
      expect(list.selectorsFor('news.example'), isNot(contains('.global-ad')));
    });
  });

  group('Categories', () {
    final list = BlockListParser.parse(<String>[
      '!# category: ads',
      '||ad.example^',
      '!# category: trackers',
      '||tracker.example^',
      '!# category: allow',
      '@@||ad.example/ok^',
    ].join('\n'));

    test('rules are tagged by section', () {
      expect(list.network.where((r) => r.category == 'trackers'), hasLength(1));
    });

    test('turning trackers off keeps ads and every exception', () {
      final filtered = list.filterCategories(<String>{'ads', 'allow'});
      expect(filtered.blockRules, 1);
      expect(filtered.exceptionRules, 1);
    });
  });

  group('Bundled list', () {
    late BlockList bundled;

    setUpAll(() {
      final text = File('assets/filters/base.txt').readAsStringSync();
      bundled = BlockListParser.parse(text);
    });

    test('has enough rules to be worth shipping', () {
      expect(bundled.blockRules, greaterThan(250));
      expect(bundled.cosmetic.length, greaterThan(60));
    });

    test('never blocks a video cdn', () {
      final blocksVideo = bundled.network.any((rule) =>
          !rule.isException && rule.regex.contains('googlevideo'));
      expect(blocksVideo, isFalse);
    });

    test('has exceptions for every playback host it mentions', () {
      for (final domain in <String>[
        'googlevideo.com',
        'youtubei.googleapis.com',
        'spotifycdn.com',
      ]) {
        final allowed = bundled.network
            .any((rule) => rule.isException && rule.source.contains(domain));
        expect(allowed, isTrue, reason: '$domain must stay reachable');
      }
    });
  });
}
