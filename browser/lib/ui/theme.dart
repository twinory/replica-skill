import 'package:flutter/material.dart';

/// Design tokens. Nothing in the widgets uses a raw hex value, so a rebrand is
/// a change in this file.
class Tokens {
  Tokens._();

  static const Color ink = Color(0xFF090B0F);
  static const Color surface = Color(0xFF111419);
  static const Color raised = Color(0xFF171C24);
  static const Color line = Color(0xFF252C36);
  static const Color text = Color(0xFFEFF2F7);
  static const Color dim = Color(0xFF98A2B3);
  static const Color accent = Color(0xFF84A7FF);
  static const Color good = Color(0xFF39D98A);
  static const Color warn = Color(0xFFFFC145);
  static const Color bad = Color(0xFFFF6B6B);

  static const Color lightInk = Color(0xFFF6F7F9);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightRaised = Color(0xFFEFF1F5);
  static const Color lightLine = Color(0xFFDDE1E8);
  static const Color lightText = Color(0xFF11151B);
  static const Color lightDim = Color(0xFF5B6472);
  static const Color lightAccent = Color(0xFF2C5BD8);

  static const double radiusSmall = 10;
  static const double radius = 16;
  static const double radiusLarge = 24;
  static const double gap = 12;

  static ThemeData dark() {
    const scheme = ColorScheme.dark(
      primary: accent,
      onPrimary: ink,
      secondary: good,
      surface: surface,
      onSurface: text,
      error: bad,
      onError: ink,
      outline: line,
    );
    return _base(scheme, dark: true);
  }

  static ThemeData light() {
    const scheme = ColorScheme.light(
      primary: lightAccent,
      onPrimary: Colors.white,
      secondary: good,
      surface: lightSurface,
      onSurface: lightText,
      error: bad,
      onError: Colors.white,
      outline: lightLine,
    );
    return _base(scheme, dark: false);
  }

  static ThemeData _base(ColorScheme scheme, {required bool dark}) {
    final raised = dark ? Tokens.raised : Tokens.lightRaised;
    final line = dark ? Tokens.line : Tokens.lightLine;
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: dark ? Tokens.ink : Tokens.lightInk,
      splashFactory: InkSparkle.splashFactory,
      dividerColor: line,
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: raised,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(radiusLarge)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: raised,
        hintStyle: TextStyle(color: dark ? Tokens.dim : Tokens.lightDim, fontSize: 15),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSmall),
          borderSide: BorderSide(color: scheme.primary, width: 1.4),
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? (dark ? Tokens.ink : Colors.white)
              : (dark ? Tokens.dim : Tokens.lightDim),
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? scheme.primary
              : (dark ? Tokens.line : Tokens.lightLine),
        ),
      ),
      textTheme: Typography.material2021().white.apply(
            bodyColor: dark ? Tokens.text : Tokens.lightText,
            displayColor: dark ? Tokens.text : Tokens.lightText,
          ),
      iconTheme: IconThemeData(color: dark ? Tokens.dim : Tokens.lightDim),
    );
  }
}
