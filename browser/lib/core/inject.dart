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
  static String cosmeticCss(BlockList list, String host, {int maxSelectors = 1200}) {
    final selectors = list.selectorsFor(host).take(maxSelectors);
    final out = StringBuffer();
    for (final selector in selectors) {
      out.writeln('$selector{display:none!important}');
    }
    return out.toString();
  }

  /// The CSS App Mode adds. Everything is scoped to `html.veil-app`.
  static String appModeCss(SitePatch? patch) {
    final out = StringBuffer()
      ..writeln('html.veil-app{overscroll-behavior:none;-webkit-tap-highlight-color:transparent;}')
      ..writeln('html.veil-app body{overscroll-behavior-y:none;}')
      // Some sites pin a cookie bar or app banner to the bottom edge, which
      // sits on top of the page once the browser bar is gone.
      ..writeln('html.veil-app body{padding-bottom:0!important;}');
    for (final selector in patch?.appHide ?? const <String>[]) {
      out.writeln('html.veil-app $selector{display:none!important}');
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
    var id = 'veil-appmode-style';
    var style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = ${jsonEncode(css)};
    var root = document.documentElement;
    if (${enabled ? 'true' : 'false'}) {
      root.classList.add('veil-app');
      root.setAttribute('data-veil', 'app');
      $extra
    } else {
      root.classList.remove('veil-app');
      root.removeAttribute('data-veil');
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
  /// native player, and a `data-veil` marker so a site's own CSS can key off
  /// it if it wants to. Wrapped so a failure never reaches the page console.
  static String bootstrapScript() {
    return r'''
(function(){
  if (window.__veilBooted) { return; }
  window.__veilBooted = true;
  try {
    document.documentElement.setAttribute('data-veil', '1');
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
