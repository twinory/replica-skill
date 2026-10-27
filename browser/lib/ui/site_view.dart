import 'dart:collection';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/picker.dart';
import '../core/playback_probe.dart';
import '../core/url_rules.dart';
import '../core/user_agents.dart';
import '../models/tab.dart';
import '../state/browser_controller.dart';

/// One tab's web view. Nothing about the tab is stored in this widget: the
/// controller owns it, so switching tabs, closing a tab or rebuilding the app
/// does not lose the page.
class SiteView extends StatefulWidget {
  const SiteView({super.key, required this.controller, required this.tab});

  final BrowserController controller;
  final TabModel tab;

  @override
  State<SiteView> createState() => _SiteViewState();
}

class _SiteViewState extends State<SiteView> {
  bool _openingExternal = false;

  Future<void> _handOff(String url) async {
    if (_openingExternal) {
      return;
    }
    _openingExternal = true;
    try {
      final uri = Uri.tryParse(url);
      if (uri != null) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      // No handler for the scheme. The page stays where it was.
    } finally {
      _openingExternal = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final tab = widget.tab;
    final settings = controller.settings;

    return InAppWebView(
      key: ValueKey<String>('web-${tab.id}-${tab.generation}'),
      initialUrlRequest: URLRequest(url: WebUri(tab.url)),
      initialSettings: InAppWebViewSettings(
        javaScriptEnabled: settings.javascriptEnabled,
        javaScriptCanOpenWindowsAutomatically: false,
        supportMultipleWindows: false,
        useShouldOverrideUrlLoading: true,
        useOnDownloadStart: true,
        useShouldInterceptRequest: settings.guardRequests && Platform.isAndroid,
        mediaPlaybackRequiresUserGesture: false,
        allowsInlineMediaPlayback: true,
        allowsPictureInPictureMediaPlayback: true,
        allowsBackForwardNavigationGestures: false,
        allowsLinkPreview: false,
        transparentBackground: false,
        thirdPartyCookiesEnabled: true,
        domStorageEnabled: true,
        databaseEnabled: true,
        cacheEnabled: true,
        useHybridComposition: true,
        // The default WKWebView and Android WebView strings both announce
        // themselves as embedded browsers, which is enough for some players to
        // refuse. These are the same engines wearing the same badge the system
        // browser wears. See lib/core/user_agents.dart.
        userAgent: UserAgents.forTab(
          isIOS: Platform.isIOS,
          desktop: tab.desktopMode,
        ),
        contentBlockers: controller.blockersFor(tab),
      ),
      initialUserScripts: UnmodifiableListView<UserScript>(controller.scriptsFor(tab)),
      onWebViewCreated: (InAppWebViewController web) {
        controller.attach(tab.id, web);
        // The picker reports one selector. Everything else it does stays in the
        // page, and it cleans up whether or not a selector arrives.
        web.addJavaScriptHandler(
          handlerName: PlaybackProbe.handlerName,
          callback: (List<dynamic> args) {
            if (args.isEmpty) {
              return null;
            }
            final payload = args.first;
            if (payload is Map) {
              controller.markPlayback(
                tab.id,
                (payload['status'] ?? '').toString(),
                (payload['detail'] ?? '').toString(),
              );
            }
            return null;
          },
        );
        web.addJavaScriptHandler(
          handlerName: Picker.handlerName,
          callback: (List<dynamic> args) {
            if (args.isEmpty) {
              return null;
            }
            final payload = args.first;
            if (payload is Map) {
              final selector = (payload['selector'] ?? '').toString();
              if (selector.isNotEmpty) {
                controller.addCustomHide(tab.id, selector);
              }
            }
            return null;
          },
        );
      },
      onLoadStart: (InAppWebViewController web, WebUri? url) {
        controller.onLoadStart(tab.id, url?.toString());
      },
      onProgressChanged: (InAppWebViewController web, int progress) {
        controller.onProgress(tab.id, progress);
      },
      onTitleChanged: (InAppWebViewController web, String? title) {
        controller.onTitle(tab.id, title);
      },
      onUpdateVisitedHistory: (InAppWebViewController web, WebUri? url, bool? isReload) async {
        final back = await web.canGoBack();
        final forward = await web.canGoForward();
        controller.onVisited(tab.id, url?.toString(), back, forward);
      },
      onLoadStop: (InAppWebViewController web, WebUri? url) {
        controller.onLoadStop(tab.id, url?.toString());
      },
      onReceivedError: (InAppWebViewController web, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame ?? true) {
          controller.onLoadError(tab.id);
        }
      },
      shouldOverrideUrlLoading: (InAppWebViewController web, NavigationAction action) async {
        final url = action.request.url?.toString() ?? '';
        if (url.isEmpty) {
          return NavigationActionPolicy.ALLOW;
        }
        if (UrlRules.needsSystemBrowser(url)) {
          // Google refuses its sign-in page inside an embedded web view, so the
          // sign-in finishes in Safari or Chrome and the cookies come back.
          await _handOff(url);
          return NavigationActionPolicy.CANCEL;
        }
        if (UrlRules.isExternalScheme(url)) {
          await _handOff(url);
          return NavigationActionPolicy.CANCEL;
        }
        return NavigationActionPolicy.ALLOW;
      },
      onCreateWindow: (InAppWebViewController web, CreateWindowAction action) async {
        // Popups are how most ad networks escape a blocker. Refuse the window
        // and load the request in the tab that asked for it instead.
        final url = action.request.url?.toString();
        if (url != null && UrlRules.isHttp(url)) {
          await web.loadUrl(urlRequest: URLRequest(url: WebUri(url)));
        }
        return false;
      },
      onDownloadStartRequest: (InAppWebViewController web, DownloadStartRequest request) async {
        final url = request.url.toString();
        await _handOff(url);
      },
    );
  }
}
