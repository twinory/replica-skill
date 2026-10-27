# Deploying the Worker

One Worker does four things: the landing page, the interactive demo, the update
endpoints the app calls, and the Android download link.

## First deploy

```bash
cd browser/deploy
npm install
npx wrangler login
npm run deploy
```

`npm run deploy` runs `tools/sync-assets.py` first, which copies the app's filter
list and patch file into `public/v1/`. Commit those copies: a Worker built from a
Git connection has no Python step, and a stale copy is worse than no copy.

Wrangler prints the URL. Point the app at it:

```bash
flutter run --dart-define=HUSK_UPDATE_BASE=https://husk.your-name.workers.dev
```

## Endpoints

| path | what it returns |
| --- | --- |
| `GET /health` | `{ "ok": true }`, for uptime checks |
| `GET /v1/manifest.json` | app version floor and where the lists live |
| `GET /v1/patches.json` | App view patches, same schema as the bundled file |
| `GET /v1/filters/base.txt` | the filter list |
| `GET /download/android` | 302 to `ANDROID_BUILD_URL` |
| `GET /download/ios` | 302 to `IOS_BUILD_URL` |

All of it is static. No KV, no D1, no secrets, free plan.

## Shipping a build

Android APKs can be hosted by the Worker directly:

```bash
flutter build apk --release
# upload build/app/outputs/flutter-apk/app-release.apk somewhere public, for
# example an R2 bucket, then:
npx wrangler secret put ANDROID_BUILD_URL   # or set it in [vars]
```

iOS cannot be hosted here. Set `IOS_BUILD_URL` to a TestFlight link. If you leave
the variable empty, the route returns a 503 that says exactly why, instead of a
dead button.

## Updating filters without a release

1. Edit `../assets/filters/base.txt` or `../assets/patches/sites.json`.
2. Bump `version` in `sites.json` if you changed a patch. The app only applies a
   patch file whose version is newer than its own.
3. `npm run deploy`.

Every installed app picks the new file up on next launch, or when the user taps
Settings, Check now. That is the whole point of the Worker: ad blocking breaks
weekly, and a store review takes days.

## Local development

```bash
npm run dev     # http://localhost:8787
```

The demo is at `/demo.html`. It is a static prototype of the app: two
transitions, mock sites, no network calls. Reviewers read it, so keep the copy
honest.

## Cache behaviour

Lists are served with `max-age=300`, HTML with the Worker's default headers, JSON
manifests with `max-age=60`. If you are mid-incident and need an immediate
update, bump the version number in `sites.json`; the app compares versions
rather than trusting the cache.
