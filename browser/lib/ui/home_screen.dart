import 'package:flutter/material.dart';

import '../core/url_rules.dart';
import '../models/site.dart';
import '../state/browser_controller.dart';
import 'settings_screen.dart';
import 'theme.dart';
import 'widgets.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.controller});

  final BrowserController controller;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _query = TextEditingController();
  final FocusNode _focus = FocusNode();

  @override
  void dispose() {
    _query.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _go(String value) {
    if (value.trim().isEmpty) {
      return;
    }
    widget.controller.openTab(value);
    _query.clear();
    _focus.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final dim = dark ? Tokens.dim : Tokens.lightDim;

    return AnimatedBuilder(
      animation: controller,
      builder: (BuildContext context, Widget? _) {
        final apps = controller.patches.featured;
        final recent = controller.history.take(12).toList();

        return Scaffold(
          body: SafeArea(
            child: CustomScrollView(
              slivers: <Widget>[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 0),
                    child: Row(
                      children: <Widget>[
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary.withOpacity(0.16),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            Icons.visibility_outlined,
                            size: 19,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                        const SizedBox(width: 10),
                        const Text(
                          'Husk',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.6),
                        ),
                        const Spacer(),
                        IconButton(
                          tooltip: 'Settings',
                          onPressed: () {
                            Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => SettingsScreen(controller: controller),
                              ),
                            );
                          },
                          icon: const Icon(Icons.tune, size: 21),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                    child: TextField(
                      controller: _query,
                      focusNode: _focus,
                      onSubmitted: _go,
                      textInputAction: TextInputAction.go,
                      autocorrect: false,
                      enableSuggestions: false,
                      keyboardType: TextInputType.url,
                      style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w500),
                      decoration: InputDecoration(
                        hintText: 'Search ${controller.settings.searchName} or enter address',
                        prefixIcon: Icon(Icons.search, size: 20, color: dim),
                        suffixIcon: Padding(
                          padding: const EdgeInsets.only(right: 10),
                          child: Pill(
                            label: controller.settings.blockAds ? 'Shields on' : 'Shields off',
                            icon: controller.settings.blockAds ? Icons.shield : Icons.shield_outlined,
                            tint: controller.settings.blockAds ? Tokens.good : dim,
                            filled: false,
                          ),
                        ),
                        suffixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
                        contentPadding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        const SectionLabel('Open as an app'),
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 4,
                            mainAxisSpacing: 16,
                            crossAxisSpacing: 10,
                            childAspectRatio: 0.82,
                          ),
                          itemCount: apps.length,
                          itemBuilder: (BuildContext context, int index) {
                            final SitePatch site = apps[index];
                            return InkWell(
                              borderRadius: BorderRadius.circular(Tokens.radiusSmall),
                              onTap: () => controller.openUrl(site.start, appMode: true),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: <Widget>[
                                  SiteGlyph(
                                    icon: site.icon,
                                    color: colorFromHex(site.color),
                                    size: 56,
                                  ),
                                  const SizedBox(height: 7),
                                  Text(
                                    site.name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: dark ? Tokens.text : Tokens.lightText,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                        if (recent.isEmpty)
                          const EmptyState(
                            icon: Icons.explore_outlined,
                            title: 'Nothing opened yet',
                            body: 'Type a site above. The shield hides ads and trackers before the page loads, '
                                'and the App view button turns the site into a full screen app.',
                          )
                        else ...<Widget>[
                          Row(
                            children: <Widget>[
                              const SectionLabel('Recent'),
                              const Spacer(),
                              TextButton(
                                onPressed: controller.clearHistory,
                                child: const Text('Clear', style: TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                          ...recent.map(
                            (HistoryEntry entry) => _RecentTile(
                              entry: entry,
                              patch: controller.patchFor(entry.url),
                              onTap: () => controller.openUrl(entry.url),
                              onRemove: () => controller.removeHistory(entry.url),
                            ),
                          ),
                        ],
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _RecentTile extends StatelessWidget {
  const _RecentTile({
    required this.entry,
    required this.patch,
    required this.onTap,
    required this.onRemove,
  });

  final HistoryEntry entry;
  final SitePatch? patch;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      borderRadius: BorderRadius.circular(Tokens.radiusSmall),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 2),
        child: Row(
          children: <Widget>[
            SiteGlyph(
              icon: patch?.icon ?? 'globe',
              color: colorFromHex(patch?.color ?? '#6C7A89'),
              size: 34,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    entry.title.trim().isEmpty ? UrlRules.display(entry.url) : entry.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: dark ? Tokens.text : Tokens.lightText,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    UrlRules.display(entry.url),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: dark ? Tokens.dim : Tokens.lightDim,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: onRemove,
              visualDensity: VisualDensity.compact,
              icon: Icon(
                Icons.close,
                size: 15,
                color: dark ? Tokens.dim : Tokens.lightDim,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
