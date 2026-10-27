import 'package:flutter/material.dart';

import '../core/url_rules.dart';
import '../models/tab.dart';
import '../state/browser_controller.dart';
import 'theme.dart';

/// The bottom bar. One field, one shield, one reload, one tab count, one menu.
class AddressBar extends StatefulWidget {
  const AddressBar({
    super.key,
    required this.controller,
    required this.tab,
    required this.onMenu,
    required this.onTabs,
  });

  final BrowserController controller;
  final TabModel tab;
  final VoidCallback onMenu;
  final VoidCallback onTabs;

  @override
  State<AddressBar> createState() => _AddressBarState();
}

class _AddressBarState extends State<AddressBar> {
  late final TextEditingController _text;
  late final FocusNode _focus;
  bool _editing = false;

  @override
  void initState() {
    super.initState();
    _text = TextEditingController(text: UrlRules.display(widget.tab.url));
    _focus = FocusNode()..addListener(_onFocusChanged);
  }

  void _onFocusChanged() {
    if (!_focus.hasFocus && _editing) {
      setState(() => _editing = false);
      _text.text = UrlRules.display(widget.tab.url);
    }
  }

  @override
  void didUpdateWidget(covariant AddressBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_editing) {
      final next = UrlRules.display(widget.tab.url);
      if (next != _text.text) {
        _text.text = next;
      }
    }
  }

  @override
  void dispose() {
    _focus.dispose();
    _text.dispose();
    super.dispose();
  }

  void _submit(String value) {
    _focus.unfocus();
    setState(() => _editing = false);
    widget.controller.navigate(widget.tab.id, value);
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final tab = widget.tab;
    final surface = dark ? Tokens.raised : Tokens.lightSurface;
    final line = dark ? Tokens.line : Tokens.lightLine;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        if (tab.isLoading)
          LinearProgressIndicator(
            value: tab.progress > 0 && tab.progress < 1 ? tab.progress : null,
            minHeight: 2,
            backgroundColor: line,
            color: Theme.of(context).colorScheme.primary,
          )
        else
          SizedBox(height: 2, child: ColoredBox(color: line)),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 9, 10, 9),
          child: Row(
            children: <Widget>[
              _ShieldButton(controller: widget.controller, tab: tab),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: surface,
                    borderRadius: BorderRadius.circular(Tokens.radiusSmall),
                    border: Border.all(color: _editing ? Theme.of(context).colorScheme.primary : line),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Row(
                    children: <Widget>[
                      Icon(
                        _lockIcon(tab.url),
                        size: 14,
                        color: dark ? Tokens.dim : Tokens.lightDim,
                      ),
                      const SizedBox(width: 7),
                      Expanded(
                        child: TextField(
                          controller: _text,
                          focusNode: _focus,
                          onTap: () {
                            setState(() => _editing = true);
                            _text.selection = TextSelection(
                              baseOffset: 0,
                              extentOffset: _text.text.length,
                            );
                          },
                          onSubmitted: _submit,
                          textInputAction: TextInputAction.go,
                          autocorrect: false,
                          enableSuggestions: false,
                          keyboardType: TextInputType.url,
                          maxLines: 1,
                          style: TextStyle(
                            fontSize: 14.5,
                            color: dark ? Tokens.text : Tokens.lightText,
                            fontWeight: _editing ? FontWeight.w500 : FontWeight.w600,
                          ),
                          decoration: const InputDecoration(
                            isDense: true,
                            filled: false,
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            contentPadding: EdgeInsets.zero,
                          ),
                        ),
                      ),
                      if (_editing)
                        GestureDetector(
                          onTap: () {
                            _text.clear();
                            setState(() {});
                          },
                          child: Icon(Icons.cancel, size: 16, color: dark ? Tokens.dim : Tokens.lightDim),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 4),
              _IconButton(
                icon: tab.isLoading ? Icons.close : Icons.refresh,
                onTap: () {
                  if (tab.isLoading) {
                    widget.controller.stopLoading(tab.id);
                  } else {
                    widget.controller.reload(tab.id);
                  }
                },
              ),
              _TabCountButton(
                count: widget.controller.tabs.length,
                onTap: widget.onTabs,
              ),
              _IconButton(icon: Icons.more_horiz, onTap: widget.onMenu),
            ],
          ),
        ),
      ],
    );
  }

  IconData _lockIcon(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      return Icons.search;
    }
    return uri.scheme == 'https' ? Icons.lock : Icons.lock_open;
  }
}

class _ShieldButton extends StatelessWidget {
  const _ShieldButton({required this.controller, required this.tab});

  final BrowserController controller;
  final TabModel tab;

  @override
  Widget build(BuildContext context) {
    final on = tab.shieldsOn && controller.settings.anyShields;
    final color = on
        ? Tokens.good
        : (Theme.of(context).brightness == Brightness.dark ? Tokens.dim : Tokens.lightDim);
    return Tooltip(
      message: on ? 'Shields on for this site' : 'Shields off for this site',
      child: InkResponse(
        onTap: () => controller.toggleSiteShields(tab.id),
        radius: 22,
        child: Padding(
          padding: const EdgeInsets.all(6),
          child: Icon(on ? Icons.shield : Icons.shield_outlined, size: 20, color: color),
        ),
      ),
    );
  }
}

class _TabCountButton extends StatelessWidget {
  const _TabCountButton({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return InkResponse(
      onTap: onTap,
      radius: 22,
      child: Container(
        width: 26,
        height: 26,
        margin: const EdgeInsets.symmetric(horizontal: 2),
        decoration: BoxDecoration(
          border: Border.all(color: dark ? Tokens.line : Tokens.lightLine, width: 1.6),
          borderRadius: BorderRadius.circular(7),
        ),
        alignment: Alignment.center,
        child: Text(
          '$count',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: dark ? Tokens.text : Tokens.lightText,
          ),
        ),
      ),
    );
  }
}

class _IconButton extends StatelessWidget {
  const _IconButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkResponse(
      onTap: onTap,
      radius: 22,
      child: Padding(
        padding: const EdgeInsets.all(7),
        child: Icon(
          icon,
          size: 20,
          color: Theme.of(context).brightness == Brightness.dark ? Tokens.dim : Tokens.lightDim,
        ),
      ),
    );
  }
}
