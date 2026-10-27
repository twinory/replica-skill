# Veil

A mobile browser that strips ads and trackers before a page is painted, then
turns the site into a full screen app with one tap.

One Flutter codebase. Each phone's own engine: WKWebView on iPhone, Android
WebView on Android. That is how a two person team gets browser-quality scrolling
and video on both platforms without adopting a browser engine.

**Veil is a working name.** Clear it before you ship. `docs/store-notes.md` has
the checks.

```
browser/
  lib/            the app (Flutter, Dart)
  assets/         filter list and App view patches, the two files that matter
  tools/          asset checks, sync to the Worker, platform scaffold
  tests/          the checks that run without a phone
  deploy/         Cloudflare Worker: landing page, demo, update endpoints
  docs/           feasibility, platform setup, store notes
```

## What it does

**Shields.** Adblock syntax compiled into native content blockers, so a blocked
request never leaves the phone. 311 network rules, 129 element hiding rules, 33
exceptions in the bundled list, split into ad and tracker sections so either can
be switched off. Per site toggle in the address bar, because every rule list
breaks something eventually.

**App view.** After a page loads, a chip appears. Tap it and the browser chrome
slides away, the page reflows into the freed space, per site CSS removes the
web-only furniture, safe areas are respected, and the back gesture navigates the
site instead of the browser. Nothing reloads, and leaving puts the page back
exactly as it was. The choice is remembered per site.

**Twelve site patches** ship in `assets/patches/sites.json`: video, music, forum,
community, reading, and a few plain pages to prove App view does not fight sites
that already fit. Each patch is CSS plus a small guarded script. None of them
touch page data.

**Update server.** A Cloudflare Worker serves the landing page, an interactive
demo of the app, and the filter and patch files. A broken selector is fixed by
deploying the Worker, not by waiting for a store review.

**No account, no analytics, no crash SDK, no telemetry.** The only network calls
are the sites you open and the update server you choose.

## Run it

```bash
cd browser
bash tools/scaffold.sh      # once: adds android/ and ios/ without touching lib/
flutter pub get
flutter run
```

Checks that run without a phone or a Flutter toolchain:

```bash
python3 tools/check_assets.py
python3 -m unittest discover -s tests -v
```

## Publish it

The Worker is the whole backend.

```bash
cd browser/deploy
npm install
npm run dev      # local: landing page, demo, /v1 endpoints
npm run deploy   # syncs assets, then publishes to your Cloudflare account
```

Then point the app at your Worker:

```bash
flutter run --dart-define=VEIL_UPDATE_BASE=https://your-worker.workers.dev
```

Endpoints: `/v1/manifest.json`, `/v1/patches.json`, `/v1/filters/base.txt`,
`/health`. All static, all cacheable, no database, free tier is plenty.

The demo at `/demo.html` is a hand written prototype of the app's two
transitions. It exists so the feel can be reviewed in a browser before anyone
builds a binary. It is not the app.

## Adding a site to App view

1. Open the site in the app, in the browser view.
2. Write down what makes it look like a browser: the app install bar, the cookie
   shelf, the header that duplicates app navigation.
3. Add an entry to `assets/patches/sites.json`:

```json
{
  "id": "example",
  "name": "Example",
  "hosts": ["example.com"],
  "start": "https://example.com/",
  "featured": false,
  "icon": "globe",
  "color": "#6C7A89",
  "cosmetic": [".ad-slot"],
  "appMode": {
    "hide": [".app-install-banner"],
    "css": "html.veil-app body{background:#0b0b0b!important}",
    "js": "document.documentElement.classList.add('veil-app');"
  },
  "notes": "What still does not work, in one sentence."
}
```

4. Run `python3 tools/check_assets.py`. It rejects selectors one of the two
   engines cannot parse, unbalanced braces, duplicate hosts, and anything that
   would block a video CDN.
5. Deploy. The app picks the new patch up on next launch.

Rules for patches, learned from every browser that has done this: never hide a
container that also holds real content, never touch page data, always scope CSS
to `html.veil-app` so leaving App view is clean, and always wrap JS in a try.

## The limits, in one place

Also shown in the app under Settings, and at `/limits.html`:

- Ads stitched into the video stream cannot be removed. Most YouTube pre-rolls.
- Spotify and Netflix need Widevine, which iOS does not give apps. Android
  usually works.
- Google refuses its login page inside any web view. That page opens in the
  system browser and the session comes back.
- Promoted posts with no marker look exactly like normal posts.
- Sites can detect a web view and refuse to play.
- Lists need maintaining, or blocking quality drifts down over months.

`docs/feasibility.md` explains why each of those is a wall rather than a bug,
and what the alternatives cost.

## Layout of the code

| file | job |
| --- | --- |
| `lib/core/blocklist.dart` | Adblock parser, no plugin imports, unit testable |
| `lib/core/blockers.dart` | Rules to native content blockers, with a rule cap |
| `lib/core/inject.dart` | Cosmetic CSS, App view CSS and the reversible toggle |
| `lib/core/url_rules.dart` | Typed text to URL, site key, auth host detection |
| `lib/core/updates.dart` | Silent fetch of new lists, never blocks a launch |
| `lib/state/browser_controller.dart` | Tabs, shields, App view, history, persistence |
| `lib/ui/` | Home, browser chrome, tab switcher, settings, limits |
| `assets/filters/base.txt` | The list. Comments at the top document the syntax |

## Licence

MIT, same as the rest of the repo. The filter list is written here, not copied
from EasyList or any other list; if you want to use a maintained upstream list
instead, check its licence first, since several are copyleft.
