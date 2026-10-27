import 'package:flutter/material.dart';

import 'theme.dart';

IconData glyphFor(String name) {
  switch (name) {
    case 'play':
      return Icons.play_circle_fill;
    case 'music':
      return Icons.music_note;
    case 'headphones':
      return Icons.headphones;
    case 'forum':
      return Icons.forum;
    case 'chat':
      return Icons.chat_bubble;
    case 'camera':
      return Icons.camera_alt;
    case 'people':
      return Icons.people_alt;
    case 'video':
      return Icons.videocam;
    case 'tv':
      return Icons.tv;
    case 'book':
      return Icons.menu_book;
    case 'news':
      return Icons.article;
    default:
      return Icons.public;
  }
}

Color colorFromHex(String hex, {Color fallback = Tokens.accent}) {
  var value = hex.trim();
  if (value.startsWith('#')) {
    value = value.substring(1);
  }
  if (value.length == 6) {
    value = 'FF$value';
  }
  final parsed = int.tryParse(value, radix: 16);
  if (parsed == null) {
    return fallback;
  }
  return Color(parsed);
}

class SiteGlyph extends StatelessWidget {
  const SiteGlyph({
    super.key,
    required this.icon,
    required this.color,
    this.size = 52,
    this.name,
  });

  final String icon;
  final Color color;
  final double size;
  final String? name;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withOpacity(dark ? 0.18 : 0.12),
        borderRadius: BorderRadius.circular(size * 0.28),
        border: Border.all(color: color.withOpacity(0.28)),
      ),
      alignment: Alignment.center,
      child: Icon(glyphFor(icon), size: size * 0.46, color: color),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill({
    super.key,
    required this.label,
    this.icon,
    this.onTap,
    this.tint,
    this.filled = true,
  });

  final String label;
  final IconData? icon;
  final VoidCallback? onTap;
  final Color? tint;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final color = tint ?? (dark ? Tokens.accent : Tokens.lightAccent);
    final body = Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
      decoration: BoxDecoration(
        color: filled ? color.withOpacity(0.16) : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(filled ? 0.4 : 0.6)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 7),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.1,
            ),
          ),
        ],
      ),
    );
    if (onTap == null) {
      return body;
    }
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: body,
    );
  }
}

class Sheet extends StatelessWidget {
  const Sheet({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: padding ?? const EdgeInsets.fromLTRB(18, 6, 18, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 14),
                decoration: BoxDecoration(
                  color: Theme.of(context).dividerColor,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            child,
          ],
        ),
      ),
    );
  }
}

class SheetRow extends StatelessWidget {
  const SheetRow({
    super.key,
    required this.icon,
    required this.label,
    this.detail,
    this.onTap,
    this.trailing,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final String? detail;
  final VoidCallback? onTap;
  final Widget? trailing;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final color = danger ? Tokens.bad : (dark ? Tokens.text : Tokens.lightText);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(Tokens.radiusSmall),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 4),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 20, color: danger ? Tokens.bad : (dark ? Tokens.dim : Tokens.lightDim)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    label,
                    style: TextStyle(fontSize: 15, color: color, fontWeight: FontWeight.w500),
                  ),
                  if (detail != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        detail!,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.35,
                          color: dark ? Tokens.dim : Tokens.lightDim,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 22, 4, 8),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: 11,
          letterSpacing: 1.1,
          fontWeight: FontWeight.w700,
          color: dark ? Tokens.dim : Tokens.lightDim,
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: Column(
        children: <Widget>[
          Icon(icon, size: 34, color: dark ? Tokens.line : Tokens.lightLine),
          const SizedBox(height: 12),
          Text(
            title,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: dark ? Tokens.text : Tokens.lightText,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            body,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              height: 1.4,
              color: dark ? Tokens.dim : Tokens.lightDim,
            ),
          ),
        ],
      ),
    );
  }
}
