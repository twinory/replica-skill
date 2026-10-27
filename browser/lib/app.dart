import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'state/browser_controller.dart';
import 'ui/browser_screen.dart';
import 'ui/home_screen.dart';
import 'ui/theme.dart';

class HuskApp extends StatelessWidget {
  const HuskApp({super.key, required this.controller});

  final BrowserController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (BuildContext context, Widget? _) {
        return MaterialApp(
          title: 'Husk',
          debugShowCheckedModeBanner: false,
          theme: Tokens.light(),
          darkTheme: Tokens.dark(),
          themeMode: _mode(controller.settings.themeMode),
          home: RootScreen(controller: controller),
        );
      },
    );
  }

  ThemeMode _mode(String value) {
    switch (value) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }
}

class RootScreen extends StatelessWidget {
  const RootScreen({super.key, required this.controller});

  final BrowserController controller;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (BuildContext context, Widget? _) {
        if (!controller.ready) {
          return const _Boot();
        }
        final showHome = controller.showingHome || controller.tabs.isEmpty;
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: Theme.of(context).brightness == Brightness.dark
              ? SystemUiOverlayStyle.light.copyWith(
                  statusBarColor: Colors.transparent,
                  systemNavigationBarColor: Colors.transparent,
                )
              : SystemUiOverlayStyle.dark.copyWith(
                  statusBarColor: Colors.transparent,
                  systemNavigationBarColor: Colors.transparent,
                ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 180),
            child: showHome
                ? HomeScreen(key: const ValueKey<String>('home'), controller: controller)
                : BrowserScreen(key: const ValueKey<String>('browser'), controller: controller),
          ),
        );
      },
    );
  }
}

class _Boot extends StatelessWidget {
  const _Boot();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      ),
    );
  }
}
