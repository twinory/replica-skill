# Platform setup

`tools/scaffold.sh` writes the Android and iOS shells and patches the two files
that a browser needs changed. This page explains what it changed and what is
still a manual step.

## First run

```bash
cd browser
bash tools/scaffold.sh     # only needed once, adds android/ and ios/
flutter pub get
flutter run
```

If `flutter run` fails on `flutter_inappwebview`, check your Flutter version.
The plugin needs Flutter 3.24 or newer and Android minSdk 21 or newer.

## What the script patches

### android/app/src/main/AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.INTERNET"/>

<queries>
    <intent>
        <action android:name="android.intent.action.VIEW"/>
        <data android:scheme="https"/>
    </intent>
    <intent>
        <action android:name="android.intent.action.VIEW"/>
        <data android:scheme="spotify"/>
    </intent>
    <intent>
        <action android:name="android.intent.action.VIEW"/>
        <data android:scheme="nflx"/>
    </intent>
</queries>
```

Why: the Flutter template only puts INTERNET in the debug and profile
manifests, so a release build has no network access and every page fails with
`net::ERR_ACCESS_DENIED`. The `<queries>` block is required from Android 11 for
`url_launcher` to see whether an app can handle a link.

### ios/Runner/Info.plist

```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>spotify</string>
    <string>nflx</string>
    <string>youtube</string>
</array>
```

## The one thing the script cannot do

**Background audio on iOS needs a native audio session.** The `UIBackgroundModes`
key stops the app being killed, but WKWebView pauses its media when the app goes
to the background unless the session category is set. Add this to
`ios/Runner/AppDelegate.swift`:

```swift
import AVFoundation

@main
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      // Audio keeps working while the app is in front. Background playback
      // is the only thing that does not.
    }
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
```

That is the whole change. Android needs nothing: web audio keeps playing when
the app goes to the background, until the system reclaims the process.

## Downloads and file pickers

`onDownloadStartRequest` hands the URL to the system browser, which owns
downloads and their permissions. If you would rather download inside the app,
that is a native download manager plus a notification channel on Android and a
document picker on iOS, roughly a week of work, and it is not in this build
because doing it badly is worse than not doing it.

Camera and microphone in a page (a video call in a tab) need
`NSCameraUsageDescription` and `NSMicrophoneUsageDescription` in Info.plist, plus
a permission request handler. The handler is in the plugin API as
`onPermissionRequest`. Not wired up here; the app does not ask a site for the
camera unless you add it.

## Build for testing

```bash
flutter build apk --release          # Android, installable straight from the Worker
flutter build ipa --release          # iOS, needs a signing team, ships to TestFlight
```

The Android APK is the only build a Cloudflare Worker can host for direct
install. Apple installs only builds Apple signed, so the iOS button points at
TestFlight or the App Store.
