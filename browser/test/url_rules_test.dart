import 'package:flutter_test/flutter_test.dart';
import 'package:veil/core/url_rules.dart';

void main() {
  const search = 'https://duckduckgo.com/?q=%s';

  group('toUrl', () {
    test('a bare domain gets https', () {
      expect(UrlRules.toUrl('youtube.com', searchTemplate: search), 'https://youtube.com');
    });

    test('a domain with a path is kept', () {
      expect(
        UrlRules.toUrl('example.com/a/b?c=d', searchTemplate: search),
        'https://example.com/a/b?c=d',
      );
    });

    test('an explicit scheme is left alone', () {
      expect(UrlRules.toUrl('http://example.com', searchTemplate: search), 'http://example.com');
      expect(UrlRules.toUrl('https://example.com', searchTemplate: search), 'https://example.com');
    });

    test('words become a search', () {
      expect(
        UrlRules.toUrl('how to block ads', searchTemplate: search),
        'https://duckduckgo.com/?q=how%20to%20block%20ads',
      );
    });

    test('localhost and ip addresses use http', () {
      expect(UrlRules.toUrl('localhost:3000', searchTemplate: search), 'http://localhost:3000');
      expect(UrlRules.toUrl('10.0.0.1', searchTemplate: search), 'http://10.0.0.1');
    });

    test('an app scheme is not a page, so it returns null', () {
      expect(UrlRules.toUrl('spotify:track:123', searchTemplate: search), isNull);
      expect(UrlRules.toUrl('mailto:a@b.c', searchTemplate: search), isNull);
      expect(UrlRules.toUrl('javascript:alert(1)', searchTemplate: search), isNull);
      expect(UrlRules.toUrl('   ', searchTemplate: search), isNull);
    });

    test('a search template without a placeholder falls back to the default', () {
      expect(
        UrlRules.toUrl('cats', searchTemplate: 'https://example.com/search'),
        'https://duckduckgo.com/?q=cats',
      );
    });
  });

  group('site keys', () {
    test('www is dropped', () {
      expect(UrlRules.siteKeyOf('https://www.example.com/x'), 'example.com');
    });

    test('subdomains collapse to the registrable name', () {
      expect(UrlRules.siteKeyOf('https://m.youtube.com/watch?v=1'), 'youtube.com');
      expect(UrlRules.siteKeyOf('https://a.b.example.com'), 'example.com');
    });

    test('two part suffixes keep three labels', () {
      expect(UrlRules.siteKeyOf('https://news.bbc.co.uk/story'), 'bbc.co.uk');
      expect(UrlRules.siteKeyOf('https://www.amazon.co.in/x'), 'amazon.co.in');
    });

    test('localhost survives', () {
      expect(UrlRules.siteKeyOf('http://localhost:8080'), 'localhost');
    });
  });

  group('auth and external links', () {
    test('google sign in is routed to the system browser', () {
      expect(UrlRules.needsSystemBrowser('https://accounts.google.com/signin'), isTrue);
      expect(UrlRules.needsSystemBrowser('https://accounts.youtube.com/x'), isTrue);
      expect(UrlRules.needsSystemBrowser('https://youtube.com/'), isFalse);
    });

    test('non http schemes are handed to the operating system', () {
      expect(UrlRules.isExternalScheme('spotify:track:1'), isTrue);
      expect(UrlRules.isExternalScheme('https://example.com'), isFalse);
      expect(UrlRules.isExternalScheme('about:blank'), isFalse);
    });
  });

  group('display', () {
    test('strips the scheme and a trailing slash', () {
      expect(UrlRules.display('https://example.com/'), 'example.com');
      expect(UrlRules.display('https://example.com/a'), 'example.com/a');
      expect(UrlRules.display('http://example.com'), 'example.com');
    });
  });
}
