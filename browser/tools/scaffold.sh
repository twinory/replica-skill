#!/usr/bin/env bash
# Adds the Android and iOS folders this project needs, without touching lib/.
#
#   bash tools/scaffold.sh
#
# flutter create writes a template app. Running it in place would overwrite
# lib/main.dart, so it runs in a temp folder and only the platform shells are
# copied back. Then the two platform files are patched for a browser: internet
# permission, background audio, and the app schemes url_launcher has to query.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v flutter >/dev/null 2>&1; then
  echo "flutter is not on PATH. Install it from flutter.dev, then run this again." >&2
  exit 1
fi

if [ -d android ] || [ -d ios ]; then
  echo "android/ or ios/ already exists. Delete both to regenerate." >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

flutter create --org app.veil --project-name veil --platforms=android,ios "$tmp/veil"
cp -R "$tmp/veil/android" .
cp -R "$tmp/veil/ios" .
cp "$tmp/veil/.metadata" . 2>/dev/null || true

python3 - "$PWD" <<'PY'
import os
import sys

root = sys.argv[1]

# --- Android: the release manifest needs internet, and url_launcher needs to
# --- be allowed to see https and the app schemes on Android 11 and up.
manifest = os.path.join(root, "android", "app", "src", "main", "AndroidManifest.xml")
with open(manifest, encoding="utf-8") as handle:
    xml = handle.read()

internet = '    <uses-permission android:name="android.permission.INTERNET"/>\n'
if "android.permission.INTERNET" not in xml:
    xml = xml.replace("<manifest", "<manifest", 1)
    marker = xml.index("<application")
    xml = xml[:marker] + internet + xml[marker:]

queries = """    <queries>
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
"""
if "<queries>" not in xml:
    marker = xml.index("<application")
    xml = xml[:marker] + queries + xml[marker:]

with open(manifest, "w", encoding="utf-8") as handle:
    handle.write(xml)
print("patched android/app/src/main/AndroidManifest.xml")

# --- iOS: audio keeps playing when the app goes to the background, and
# --- LSApplicationQueriesSchemes lets the app hand off to a real player.
plist = os.path.join(root, "ios", "Runner", "Info.plist")
with open(plist, encoding="utf-8") as handle:
    text = handle.read()

background = """\t<key>UIBackgroundModes</key>
\t<array>
\t\t<string>audio</string>
\t</array>
"""
if "UIBackgroundModes" not in text:
    marker = text.index("</dict>")
    text = text[:marker] + background + text[marker:]

schemes = """\t<key>LSApplicationQueriesSchemes</key>
\t<array>
\t\t<string>spotify</string>
\t\t<string>nflx</string>
\t\t<string>youtube</string>
\t</array>
"""
if "LSApplicationQueriesSchemes" not in text:
    marker = text.index("</dict>")
    text = text[:marker] + schemes + text[marker:]

with open(plist, "w", encoding="utf-8") as handle:
    handle.write(text)
print("patched ios/Runner/Info.plist")
PY

cat <<'MSG'

Platform shells are in place. Next:

  flutter pub get
  flutter run

Before you ship, read docs/platform-setup.md for the iOS audio session note and
the Play Store and App Store constraints in docs/store-notes.md.
MSG
