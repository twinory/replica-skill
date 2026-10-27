import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/site.dart';
import '../models/tab.dart';
import '../state/browser_controller.dart';
import 'address_bar.dart';
import 'settings_screen.dart';
import 'site_view.dart';
import 'tabs_sheet.dart';
import 'theme.dart';
import 'widgets.dart';

class BrowserScreen extends StatelessWidget {
  const BrowserScreen({super.key, required this.controller});

  final BrowserController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (BuildContext context, Widget? _) {
        final tab = controller.active;
        if (tab == null) {
          return const SizedBox.shrink();
        }
        return PopScope(
          canPop: false,
          onPopInvokedWithResult: (bool didPop, Object? result) async {
            if (didPop) {
              return;
            }
            await _handleBack(context, tab);
          },
          child: Scaffold(
            resizeToAvoidBottomInset: false,
            body: SafeArea(
              top: true,
              bottom: !tab.appMode,
              child: Column(
                children: <Widget>[
                  Expanded(
                    child: Stack(
                      children: <Widget>[
                        IndexedStack(
                          index: controller.tabs.indexWhere((t) => t.id == tab.id).clamp(0, controller.tabs.length - 1),
                          children: controller.tabs
                              .map((t) => SiteView(controller: controller, tab: t))
                              .toList(),
                        ),
                        if (tab.failed) _FailedBanner(onRetry: () => controller.reload(tab.id)),
                        if (!tab.appMode && !tab.isLoading && tab.progress > 0)
                          Positioned(
                            right: 12,
                            bottom: 14,
                            child: _AppViewChip(
                              onTap: () => controller.setAppMode(tab.id, true),
                            ),
                          ),
                        if (tab.appMode) _exitHandle(context, tab),
                      ],
                    ),
                  ),
                  if (!tab.appMode)
                    AddressBar(
                      controller: controller,
                      tab: tab,
                      onMenu: () => _showMenu(context, tab),
                      onTabs: () => showTabsSheet(context, controller),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _handleBack(BuildContext context, TabModel tab) async {
    if (tab.appMode) {
      await controller.setAppMode(tab.id, false);
      return;
    }
    if (tab.canGoBack) {
      await controller.goBack(tab.id);
      return;
    }
    if (controller.tabs.length > 1) {
      controller.closeTab(tab.id);
      return;
    }
    controller.goHome();
  }

  /// In App Mode there is no browser bar, so the way back is a thin strip at
  /// the top edge. Tap it and the chrome returns without reloading the page.
  Widget _exitHandle(BuildContext context, TabModel tab) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      height: 26,
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => controller.setAppMode(tab.id, false),
        onLongPress: () => controller.setAppMode(tab.id, false),
        child: Align(
          alignment: Alignment.topCenter,
          child: Container(
            width: 46,
            height: 4,
            margin: const EdgeInsets.only(top: 5),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.55),
              borderRadius: BorderRadius.circular(999),
              boxShadow: <BoxShadow>[
                BoxShadow(color: Colors.black.withOpacity(0.25), blurRadius: 6),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showMenu(BuildContext context, TabModel tab) {
    final patch = controller.patchFor(tab.url);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: false,
      backgroundColor: Colors.transparent,
      builder: (BuildContext context) {
        return Sheet(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              SheetRow(
                icon: Icons.add,
                label: 'New tab',
                onTap: () {
                  Navigator.pop(context);
                  controller.goHome();
                },
              ),
              SheetRow(
                icon: tab.appMode ? Icons.crop_free : Icons.open_in_full,
                label: tab.appMode ? 'Leave App view' : 'App view',
                detail: tab.appMode
                    ? 'Back to the browser chrome'
                    : 'Full screen, no browser chrome, remembered for this site',
                onTap: () {
                  Navigator.pop(context);
                  controller.setAppMode(tab.id, !tab.appMode);
                },
              ),
              SheetRow(
                icon: Icons.shield_outlined,
                label: tab.shieldsOn ? 'Shields are on' : 'Shields are off',
                detail: controller.settings.anyShields
                    ? '${controller.effectiveList.blockRules} rules, '
                        '${controller.effectiveList.globalSelectors} element hiding rules'
                    : 'All shields are off in settings',
                onTap: () {
                  Navigator.pop(context);
                  controller.toggleSiteShields(tab.id);
                },
              ),
              SheetRow(
                icon: Icons.visibility_off_outlined,
                label: 'Hide an element here',
                detail: 'Tap anything that should not be on this page. It stays hidden on this site.',
                onTap: () {
                  Navigator.pop(context);
                  controller.startPicker(tab.id);
                },
              ),
              if (controller.hidesFor(tab.url).isNotEmpty)
                SheetRow(
                  icon: Icons.undo,
                  label: controller.hidesFor(tab.url).length == 1
                      ? 'Show the element you hid'
                      : 'Show the ${controller.hidesFor(tab.url).length} elements you hid',
                  detail: 'Your picks on this site, not the filter list',
                  onTap: () {
                    Navigator.pop(context);
                    controller.clearCustomHides(tab.id);
                  },
                ),
              SheetRow(
                icon: Icons.copy_all,
                label: 'Copy link',
                onTap: () {
                  Clipboard.setData(ClipboardData(text: tab.url));
                  Navigator.pop(context);
                  _toast(context, 'Link copied');
                },
              ),
              SheetRow(
                icon: Icons.open_in_browser,
                label: 'Open in the system browser',
                onTap: () {
                  Navigator.pop(context);
                  launchUrl(Uri.parse(tab.url), mode: LaunchMode.externalApplication);
                },
              ),
              if (patch?.handoff != null)
                SheetRow(
                  icon: Icons.phone_iphone,
                  label: patch!.handoff!.label,
                  detail: patch.handoff!.reason,
                  onTap: () {
                    Navigator.pop(context);
                    _openHandoff(context, patch.handoff!);
                  },
                ),
              SheetRow(
                icon: Icons.tune,
                label: 'Settings',
                onTap: () {
                  Navigator.pop(context);
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => SettingsScreen(controller: controller),
                    ),
                  );
                },
              ),
              if (patch != null && patch.notes.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 10, 4, 2),
                  child: Text(
                    patch.notes,
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.4,
                      color: Theme.of(context).brightness == Brightness.dark
                          ? Tokens.dim
                          : Tokens.lightDim,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _openHandoff(BuildContext context, Handoff handoff) async {
    final url = Theme.of(context).platform == TargetPlatform.iOS ? handoff.storeIos : handoff.storeAndroid;
    if (url.isEmpty) {
      return;
    }
    final appScheme = Theme.of(context).platform == TargetPlatform.iOS ? handoff.ios : handoff.android;
    final schemeUri = Uri.tryParse(appScheme);
    if (schemeUri != null && appScheme.isNotEmpty) {
      try {
        final opened = await launchUrl(schemeUri, mode: LaunchMode.externalApplication);
        if (opened) {
          return;
        }
      } catch (_) {
        // App not installed, fall through to the store.
      }
    }
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }
}

void _toast(BuildContext context, String message) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  messenger?.showSnackBar(
    SnackBar(
      content: Text(message),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(seconds: 2),
    ),
  );
}

class _AppViewChip extends StatelessWidget {
  const _AppViewChip({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
      builder: (BuildContext context, double t, Widget? child) {
        return Opacity(
          opacity: t,
          child: Transform.scale(scale: 0.92 + 0.08 * t, child: child),
        );
      },
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF0B0D12).withOpacity(0.82),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: Colors.white.withOpacity(0.14)),
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: Colors.black.withOpacity(0.35),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const Icon(Icons.open_in_full, size: 15, color: Colors.white),
                const SizedBox(width: 7),
                Text(
                  'App view',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.95),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.1,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FailedBanner extends StatelessWidget {
  const _FailedBanner({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: 14,
      right: 14,
      top: 14,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Tokens.bad.withOpacity(0.12),
          borderRadius: BorderRadius.circular(Tokens.radius),
          border: Border.all(color: Tokens.bad.withOpacity(0.4)),
        ),
        child: Row(
          children: <Widget>[
            const Icon(Icons.wifi_off, size: 18, color: Tokens.bad),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'That page did not load.',
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500),
              ),
            ),
            TextButton(
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
