# Deploying the Worker

One Worker does four things: the landing page, the interactive demo, the update
endpoints the app calls, and the build download links. No KV, no D1, no
database, no secrets. It runs on the free plan.

These steps were run against wrangler 4.153.0 and Cloudflare's local runtime,
which is the same workerd the edge runs. Two things found that way are baked in
below: wrangler 3 silently ignores the `[assets]` block, and the assets layer
drops `.html` from URLs unless `html_handling` says otherwise.

## What you need

- A Cloudflare account, free plan is enough.
- Node.js 20 or newer (`node --version`). Wrangler 4 refuses older.
- Python 3 only if you want `npm run deploy` to sync the lists for you. The
  synced copies are committed, so deploying without Python works too.

## First deploy, step by step

### 1. Install the tools

```bash
cd browser/deploy
npm ci
```

`npm ci` installs exactly what `package-lock.json` pins. If you change the
wrangler version later, use `npm install --save-dev wrangler@4` so the lock
moves with it.

### 2. Sign in

```bash
npx wrangler login
```

This opens a browser, asks for the account you want, and stores an OAuth token
in `~/.wrangler`. Nothing is written into the repo.

On a machine with no browser, or in CI, skip this and export a token instead:

```bash
export CLOUDFLARE_API_TOKEN=...   # template "Edit Cloudflare Workers"
export CLOUDFLARE_ACCOUNT_ID=...
```

Create the token in the Cloudflare dashboard under My Profile, API Tokens. Never
commit it.

### 3. Sync the lists

```bash
npm run sync
```

That runs `../tools/sync-assets.py`, which copies the app's `assets/filters/base.txt`
and `assets/patches/sites.json` into `public/v1/`, where the Worker serves them
from. A Worker built from a Git connection has no Python step, which is why the
copies are committed as well. If a copy drifts from the app's asset, the test
suite fails, so this cannot rot quietly.

### 4. Check before you ship

```bash
npx wrangler deploy --dry-run
```

This bundles the Worker and lists its bindings without touching Cloudflare. You
want to see four lines: `env.ASSETS` as Assets, then `MIN_APP_VERSION`,
`ANDROID_BUILD_URL` and `IOS_BUILD_URL`. If `env.ASSETS` is missing, you are on
wrangler 3 and the deploy would throw on every request.

### 5. Deploy

```bash
npm run deploy
```

That is `sync` then `wrangler deploy`. Wrangler uploads the script, uploads the
ten files in `public/`, and prints the URL:

```
https://husk.<your-subdomain>.workers.dev
```

The first deploy asks you to register a `workers.dev` subdomain if the account
has none yet. Pick anything; it only appears in this URL.

### 6. Verify what actually landed

```bash
BASE=https://husk.<your-subdomain>.workers.dev

curl -s  $BASE/health
curl -s  $BASE/v1/manifest.json
curl -si $BASE/v1/patches.json | head -20
curl -s  $BASE/v1/filters/base.txt | wc -l
curl -so /dev/null -w '%{http_code}\n' $BASE/demo.html
curl -so /dev/null -w '%{http_code}\n' $BASE/download/ios
```

What each answer should be:

| check | expected |
| --- | --- |
| `/health` | `{"ok":true,...}` |
| `/v1/manifest.json` | URLs on the workers.dev host, not localhost |
| `/v1/patches.json` | `"version": 3` and 13 sites |
| `/v1/filters/base.txt` | 536 lines |
| `/demo.html` | `200` |
| `/download/ios` | `503` until `IOS_BUILD_URL` is set |
| anything else | `404`, with the landing page as the body |

The manifest URLs matter. They are built from the request host, so a correct
manifest proves the Worker is running rather than a static file being served.

### 7. Point the app at it

```bash
cd ..
flutter run --dart-define=HUSK_UPDATE_BASE=$BASE
```

Then Settings, Check now, which fetches `/v1/manifest.json` and compares the
patches version. On a release build the base URL is compiled in, so this is the
one define that has to be right.

## Everyday changes

Lists: edit `../assets/filters/base.txt` or `../assets/patches/sites.json`, bump
`version` in `sites.json` when a patch changes, then `npm run deploy`. Every
installed app picks the new file up on next launch. No store review. That is the
whole reason this Worker exists: ad blocking breaks weekly and app review takes
days.

Code: edit `src/index.js` or anything in `public/`, then `npm run deploy`.

## Routes

| path | what it returns |
| --- | --- |
| `GET /` | landing page |
| `GET /demo.html`, `/demo` | interactive demo of App view |
| `GET /limits.html`, `/limits` | the honest limits page |
| `GET /health` | `{"ok":true}`, for uptime checks |
| `GET /v1/manifest.json` | app version floor and where the lists live |
| `GET /v1/patches.json` | App view patches, same schema as the bundled file |
| `GET /v1/filters/base.txt` | the filter list |
| `GET /download/android` | 302 to `ANDROID_BUILD_URL`, or a 503 page |
| `GET /download/ios` | 302 to `IOS_BUILD_URL`, or a 503 page |

Both extension forms are served because the landing page links use `.html` and
the assets layer used to redirect those to the extensionless form. Old links
keep working.

## Shipping a build

Android APKs can be hosted by the Worker or anywhere public:

```bash
flutter build apk --release
npx wrangler r2 object put husk-builds/app-release.apk --file build/app/outputs/flutter-apk/app-release.apk
```

Then set the URL in `[vars]` in `wrangler.toml` and deploy again. Note that a
value in `[vars]` is plain text and public, which is fine for a download URL and
wrong for anything secret.

iOS cannot be hosted here. Apple installs only builds Apple signed, so set
`IOS_BUILD_URL` to a TestFlight or App Store link. While it is empty the route
returns a 503 page that says why, instead of a dead button.

## Local development

```bash
npm run dev       # wrangler dev, http://localhost:8787, the real runtime
npm run preview   # node only, http://localhost:8080, no wrangler needed
```

`npm run preview` runs `tools/preview.mjs`, which calls the same `src/index.js`
and stands in for the assets binding with a small static handler. Use it when
you do not want an `npm install`. It widens `frame-ancestors` so the site can be
embedded in a preview pane; the deployed Worker keeps `SAMEORIGIN`.

The demo lives at `/demo.html`. It is a static prototype: two transitions, mock
sites, no network calls. Reviewers read it, so keep the copy honest.

## Cache behaviour, and how to force an update

Lists are served with `max-age=300`, the manifest with `max-age=60`, HTML with
the Worker's default headers. If you are mid-incident and need every app on the
new list immediately, bump `version` in `sites.json` and deploy: the app compares
versions rather than trusting the cache, so a stale copy is skipped.

## When the deploy goes wrong

| symptom | cause |
| --- | --- |
| `env.ASSETS` undefined at runtime, every request 500 | wrangler 3, which ignores `[assets]`. Use wrangler 4. |
| `/demo.html` 307s to `/demo` | `html_handling` removed from `wrangler.toml` |
| `/` returns 404 | the `'/'` entry was removed from `PATH_ALIASES` in `src/index.js` |
| `/v1/patches.json` says "Not synced yet" | `npm run deploy` was replaced by a bare `wrangler deploy` before the sync ran |
| deploy fails with an auth error | `wrangler login` expired, or the token lacks the Workers permission |
