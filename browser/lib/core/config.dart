/// Where the app looks for filter and App Mode updates.
///
/// This is the Cloudflare Worker in `deploy/`. Point it at your own domain
/// before shipping; nothing else in the app hard codes a host.
class AppConfig {
  AppConfig._();

  static const String updateBase = String.fromEnvironment(
    'HUSK_UPDATE_BASE',
    defaultValue: 'https://husk-updates.example.workers.dev',
  );

  static const String patchesUrl = '$updateBase/v1/patches.json';
  static const String filtersUrl = '$updateBase/v1/filters/base.txt';
  static const String manifestUrl = '$updateBase/v1/manifest.json';

  static const Duration updateTimeout = Duration(seconds: 8);

  /// Bump when the way patches are read changes, so an old app ignores a new
  /// file it cannot parse instead of crashing on it.
  static const int patchSchemaVersion = 1;
}
