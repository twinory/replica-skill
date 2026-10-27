import 'package:flutter/material.dart';

import '../models/settings.dart';
import '../state/browser_controller.dart';
import 'theme.dart';
import 'widgets.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.controller});

  final BrowserController controller;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final dim = dark ? Tokens.dim : Tokens.lightDim;

    return AnimatedBuilder(
      animation: controller,
      builder: (BuildContext context, Widget? _) {
        final settings = controller.settings;
        return Scaffold(
          appBar: AppBar(
            title: const Text('Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 40),
            children: <Widget>[
              const SectionLabel('Search'),
              SheetRow(
                icon: Icons.search,
                label: settings.searchName,
                detail: 'Where the address bar sends what you type',
                trailing: Icon(Icons.chevron_right, color: dim, size: 18),
                onTap: () => _pickSearchEngine(context, settings),
              ),

              const SectionLabel('Shields'),
              _toggle(
                'Block ads',
                'Network rules stop ad requests before they leave the phone',
                settings.blockAds,
                (bool v) => controller.setSettings(settings.copyWith(blockAds: v)),
              ),
              _toggle(
                'Block trackers',
                'Analytics, session recorders and ad identifiers',
                settings.blockTrackers,
                (bool v) => controller.setSettings(settings.copyWith(blockTrackers: v)),
              ),
              _toggle(
                'Hide ad spaces',
                'CSS rules remove the empty boxes ads leave behind',
                settings.hideCosmetic,
                (bool v) => controller.setSettings(settings.copyWith(hideCosmetic: v)),
              ),
              _toggle(
                'Second network guard',
                'Android only. Refuses matched requests in the web view client. '
                    'Off by default: request interception has a known freeze bug on long sessions',
                settings.guardRequests,
                (bool v) => controller.setSettings(settings.copyWith(guardRequests: v)),
              ),
              SheetRow(
                icon: Icons.list_alt,
                label: '${controller.blockList.blockRules} network rules',
                detail: '${controller.blockList.cosmetic.length} element hiding rules, '
                    '${controller.blockList.skipped} unsupported lines skipped',
                trailing: Text(
                  controller.blockList.label,
                  style: TextStyle(fontSize: 11, color: dim),
                ),
              ),
              if (controller.shieldsOff.isNotEmpty)
                SheetRow(
                  icon: Icons.shield_outlined,
                  label: 'Allowed sites',
                  detail: controller.shieldsOff.join(', '),
                  trailing: TextButton(
                    onPressed: controller.resetAllowedSites,
                    child: const Text('Reset'),
                  ),
                ),

              const SectionLabel('App view'),
              _toggle(
                'Remember per site',
                'When on, a site that was promoted to App view opens that way next time',
                settings.rememberAppMode,
                (bool v) => controller.setSettings(settings.copyWith(rememberAppMode: v)),
              ),
              if (controller.appHosts.isNotEmpty)
                SheetRow(
                  icon: Icons.apps,
                  label: '${controller.appHosts.length} sites open as apps',
                  detail: controller.appHosts.join(', '),
                ),

              const SectionLabel('Updates'),
              _toggle(
                'Check for new lists',
                'Filter and App view fixes from the update server, without a new build',
                settings.remoteUpdates,
                (bool v) => controller.setSettings(settings.copyWith(remoteUpdates: v)),
              ),
              SheetRow(
                icon: Icons.sync,
                label: 'Check now',
                detail: controller.statusNote.isEmpty ? 'Not checked yet' : controller.statusNote,
                onTap: () => controller.refreshRemote(),
                trailing: Icon(Icons.refresh, size: 18, color: dim),
              ),

              const SectionLabel('Data'),
              SheetRow(
                icon: Icons.delete_sweep_outlined,
                label: 'Clear browsing data',
                detail: 'History, open tabs, cache and cookies',
                danger: true,
                onTap: () => _confirmClear(context),
              ),

              const SectionLabel('About'),
              const SheetRow(
                icon: Icons.info_outline,
                label: 'Veil 0.1.0',
                detail: 'Flutter shell, the system web engine, no telemetry',
              ),
              SheetRow(
                icon: Icons.gpp_maybe_outlined,
                label: 'What this app cannot do',
                detail: 'Read this before trusting the shield',
                trailing: Icon(Icons.chevron_right, size: 18, color: dim),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const LimitsScreen()),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _toggle(String label, String detail, bool value, ValueChanged<bool> onChanged) {
    return SheetRow(
      icon: value ? Icons.check_circle : Icons.circle_outlined,
      label: label,
      detail: detail,
      trailing: Switch(value: value, onChanged: onChanged),
    );
  }

  Future<void> _pickSearchEngine(BuildContext context, Settings settings) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (BuildContext context) {
        return Sheet(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              for (final engine in Settings.searchEngines)
                SheetRow(
                  icon: engine[0] == settings.searchName ? Icons.radio_button_checked : Icons.radio_button_off,
                  label: engine[0],
                  onTap: () {
                    controller.setSettings(settings.copyWith(
                      searchName: engine[0],
                      searchTemplate: engine[1],
                    ));
                    Navigator.pop(context);
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _confirmClear(BuildContext context) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Clear browsing data?'),
        content: const Text(
          'History, open tabs, cache and cookies are removed. Sites will ask you to sign in again.',
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Clear', style: TextStyle(color: Tokens.bad)),
          ),
        ],
      ),
    );
    if (yes ?? false) {
      await controller.clearBrowsingData();
      if (context.mounted) {
        Navigator.of(context).pop();
      }
    }
  }
}

/// The limits page. It exists because every ad-free browser on the store
/// over-promises, and the first time a pre-roll plays the user blames the app.
class LimitsScreen extends StatelessWidget {
  const LimitsScreen({super.key});

  static const List<List<String>> _limits = <List<String>>[
    <String>[
      'Ads inside the video stream cannot be removed',
      'When a site stitches the ad into the same video file as the show, there is nothing to block. '
          'That covers most YouTube pre-rolls, Twitch and live sport. The player patch skips past what it can.',
    ],
    <String>[
      'Spotify and Netflix need their own app on iPhone',
      'Their web players stream DRM protected media. Apple does not give apps Widevine, so a web view cannot '
          'decrypt it. On Android it usually works. Veil offers the real app instead of a black screen.',
    ],
    <String>[
      'Google sign-in finishes in the system browser',
      'Google refuses its login page inside any embedded web view. Veil sends that one page to Safari or Chrome '
          'and the session comes back to the tab.',
    ],
    <String>[
      'First-party promoted posts can survive',
      'A promoted post served from the same endpoint as normal posts, with no wrapper element, looks exactly '
          'like a normal post. Rules catch the ones with a marker. The rest need a maintainer.',
    ],
    <String>[
      'Sites can still detect this browser',
      'A page can see it is in a web view and refuse to play, or ask you to install its app. Veil hides app '
          'banners but cannot make a site believe it is Safari.',
    ],
    <String>[
      'Rule lists need looking after',
      'Ad networks rotate domains weekly. The bundled list is a starting point; point the update server at your '
          'own fork and keep it current, or blocking quality drifts down over months.',
    ],
  ];

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Limits', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 40),
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 16),
            child: Text(
              'No browser can promise zero ads everywhere. This is the honest list of what the shield does '
              'and does not reach.',
              style: TextStyle(
                fontSize: 13.5,
                height: 1.45,
                color: dark ? Tokens.dim : Tokens.lightDim,
              ),
            ),
          ),
          for (final item in _limits)
            Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    item[0],
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: dark ? Tokens.text : Tokens.lightText,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    item[1],
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.5,
                      color: dark ? Tokens.dim : Tokens.lightDim,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
