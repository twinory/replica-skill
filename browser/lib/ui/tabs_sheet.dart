import 'package:flutter/material.dart';

import '../core/url_rules.dart';
import '../state/browser_controller.dart';
import 'theme.dart';
import 'widgets.dart';

Future<void> showTabsSheet(BuildContext context, BrowserController controller) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (BuildContext context) {
      return AnimatedBuilder(
        animation: controller,
        builder: (BuildContext context, Widget? _) {
          final dark = Theme.of(context).brightness == Brightness.dark;
          return Sheet(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    const Text(
                      'Tabs',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        controller.goHome();
                      },
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('New'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (controller.tabs.isEmpty)
                  const EmptyState(
                    icon: Icons.tab_unavailable,
                    title: 'No open tabs',
                    body: 'Open a site from the home screen to start browsing.',
                  )
                else
                  ConstrainedBox(
                    constraints: BoxConstraints(
                      maxHeight: MediaQuery.of(context).size.height * 0.55,
                    ),
                    child: GridView.builder(
                      shrinkWrap: true,
                      padding: const EdgeInsets.only(bottom: 4),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        mainAxisSpacing: 10,
                        crossAxisSpacing: 10,
                        childAspectRatio: 1.25,
                      ),
                      itemCount: controller.tabs.length,
                      itemBuilder: (BuildContext context, int index) {
                        final tab = controller.tabs[index];
                        final selected = tab.id == controller.activeId;
                        return InkWell(
                          borderRadius: BorderRadius.circular(Tokens.radius),
                          onTap: () {
                            controller.activateTab(tab.id);
                            Navigator.pop(context);
                          },
                          child: Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: selected
                                  ? Theme.of(context).colorScheme.primary.withOpacity(0.12)
                                  : (dark ? Tokens.surface : Tokens.lightRaised),
                              borderRadius: BorderRadius.circular(Tokens.radius),
                              border: Border.all(
                                color: selected
                                    ? Theme.of(context).colorScheme.primary.withOpacity(0.5)
                                    : (dark ? Tokens.line : Tokens.lightLine),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Row(
                                  children: <Widget>[
                                    Expanded(
                                      child: Text(
                                        UrlRules.siteKeyOf(tab.url),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w600,
                                          color: dark ? Tokens.dim : Tokens.lightDim,
                                        ),
                                      ),
                                    ),
                                    GestureDetector(
                                      onTap: () => controller.closeTab(tab.id),
                                      child: Icon(
                                        Icons.close,
                                        size: 15,
                                        color: dark ? Tokens.dim : Tokens.lightDim,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Expanded(
                                  child: Text(
                                    tab.label,
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13,
                                      height: 1.3,
                                      fontWeight: FontWeight.w500,
                                      color: dark ? Tokens.text : Tokens.lightText,
                                    ),
                                  ),
                                ),
                                if (tab.appMode)
                                  const Padding(
                                    padding: EdgeInsets.only(top: 4),
                                    child: Text(
                                      'App view',
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w700,
                                        color: Tokens.accent,
                                        letterSpacing: 0.4,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                if (controller.tabs.isNotEmpty)
                  TextButton(
                    onPressed: () {
                      controller.closeAllTabs();
                      Navigator.pop(context);
                    },
                    child: const Text('Close all tabs'),
                  ),
              ],
            ),
          );
        },
      );
    },
  );
}
