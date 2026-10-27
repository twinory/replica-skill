import 'dart:convert';

import '../models/site.dart';
import 'blocklist.dart';

/// Builds the CSS and JavaScript that goes into a page.
///
/// Two rules here, both learned the hard way by every browser that injects
/// anything: never throw into the page, and always be reversible. App Mode is
/// one class on `<html>` plus one `<style>` element, so leaving it puts the
/// page back exactly as it was without a reload.
class Injector {
  Injector._();

  /// Element hiding rules, one per line so a selector the engine rejects
  /// cannot take the rest of the list down with it.
  static String cosmeticCss(
    BlockList list,
    String host, {
    int maxSelectors = 1200,
    List<String> custom = const <String>[],
  }) {
    final out = StringBuffer();
    var budget = maxSelectors;
    for (final selector in custom) {
      if (budget-- <= 0) {
        break;
      }
      out.writeln('$selector{display:none!important}');
    }
    for (final selector in list.selectorsFor(host)) {
      if (budget-- <= 0) {
        break;
      }
      out.writeln('$selector{display:none!important}');
    }
    return out.toString();
  }

  /// Overlays that exist only to sell the native app. Safe on any site: these
  /// are marketing strips, never content. Every selector is a plain attribute
  /// match, because `:has` is missing on older engines.
  static const List<String> universal = <String>[
    '#smartbanner',
    '.smartbanner',
    '.smart-app-banner',
    '[class*="smartbanner"]',
    '[id*="app-install"]',
    '[class*="app-install"]',
    '[class*="install-banner"]',
    '[class*="app-banner"]',
    '[class*="appBanner"]',
    '[class*="open-in-app"]',
    '[class*="openInApp"]',
    '[class*="download-app"]',
    '[class*="downloadApp"]',
    '[class*="get-the-app"]',
    '[class*="getTheApp"]',
    '[class*="app-promo"]',
    '[class*="appPromo"]',
    '[class*="mobile-app-banner"]',
    '[data-testid*="app-banner"]',
    '[data-testid*="open-in-app"]',
    '.branch-banner',
    '#branch-banner-iframe',
    '.adjust-banner',
  ];

  /// The CSS App Mode adds. Everything is scoped to `html.husk-app`.
  static String appModeCss(SitePatch? patch) {
    final out = StringBuffer()
      ..writeln('html.husk-app{overscroll-behavior:none;-webkit-tap-highlight-color:transparent;}')
      ..writeln('html.husk-app body{overscroll-behavior-y:none;}')
      // Some sites pin a cookie bar or app banner to the bottom edge, which
      // sits on top of the page once the browser bar is gone.
      ..writeln('html.husk-app body{padding-bottom:0!important;}');
    for (final selector in universal) {
      out.writeln('html.husk-app $selector{display:none!important}');
    }
    for (final selector in patch?.appHide ?? const <String>[]) {
      out.writeln('html.husk-app $selector{display:none!important}');
    }
    out.write(patch?.appCss ?? '');
    return out.toString();
  }

  /// Applies or removes App Mode without a reload.
  static String appModeScript(SitePatch? patch, {required bool enabled}) {
    final css = enabled ? appModeCss(patch) : '';
    final extra = enabled ? (patch?.appJs ?? '') : '';
    return '''
(function(){
  try {
    var id = 'husk-appmode-style';
    var style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = ${jsonEncode(css)};
    var root = document.documentElement;
    if (${enabled ? 'true' : 'false'}) {
      root.classList.add('husk-app');
      root.setAttribute('data-husk', 'app');
      $extra
    } else {
      root.classList.remove('husk-app');
      root.removeAttribute('data-husk');
    }
    return true;
  } catch (e) { return false; }
})();
''';
  }

  /// Runs on every page, before the site's own scripts, when shields are on
  /// for that page and the site has a player patch.
  static String playerScript(SitePatch? patch) {
    if (patch == null || patch.playerJs.trim().isEmpty) {
      return '';
    }
    return 'try{${patch.playerJs}}catch(e){}';
  }

  /// Small document start script: inline video so it does not jump to the
  /// native player, and a `data-husk` marker so a site's own CSS can key off
  /// it if it wants to. Wrapped so a failure never reaches the page console.
  static String bootstrapScript() {
    return r'''
(function(){
  if (window.__huskBooted) { return; }
  window.__huskBooted = true;
  try {
    document.documentElement.setAttribute('data-husk', '1');
    var inline = function(){
      var videos = document.querySelectorAll('video');
      for (var i = 0; i < videos.length; i++) {
        videos[i].setAttribute('playsinline', '');
        videos[i].setAttribute('webkit-playsinline', '');
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inline);
    } else {
      inline();
    }
  } catch (e) {}
})();
''';
  }

  /// Reads the page background so the status bar can match it instead of
  /// sitting on a strip of the wrong colour.
  static const String pageBackgroundScript = '''
(function(){
  try {
    var el = document.body || document.documentElement;
    var c = window.getComputedStyle(el).backgroundColor;
    if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') {
      c = window.getComputedStyle(document.documentElement).backgroundColor;
    }
    return c || '';
  } catch (e) { return ''; }
})();
''';

  /// Scroll offset, used to show the address bar again after a flick up.
  static const String scrollTopScript = 'window.scrollY || document.documentElement.scrollTop || 0;';
}
