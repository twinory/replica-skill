# Deploy checklist: Chowk

Date: 2026-10-20  Commit: 1c1226f  Go from user: **not yet**

Nothing has been deployed. No domain was bought, no account was created and no
key was entered. The skill's rule is that the user does the account steps and
gives the go; this file records what has passed and what is still open.

## Preflight

| check | command | result |
| --- | --- | --- |
| skill pack tests | `python3 -m unittest discover -s tests` | pass, 57 tests |
| browser flows | headless Chromium click-through of 38 cases in `test-plan.md` | pass, no console errors |
| open S1 or S2 bugs | `replica/bugs.md` | none open, 11 fixed |
| parity, must-haves | `python3 replica-diff/parity.py replica/features.csv` | 100.0, 11 of 11 must-haves |
| rebrand sweep | `python3 replica-brand/sweep.py app --config replica/brand.json` | clean, exit 0 |
| contrast | `python3 replica-design/contrast.py replica/design/tokens.json` | 15 pairs, 0 failing AA |
| store listing | `python3 replica-launch/listing.py replica/launch/listing.json` | 0 errors, 0 warnings |
| production build | none: there is no build step | n/a, static files |
| privacy page | not written | **open** |
| account deletion | n/a, there are no accounts; Settings has a one click reset | done |
| favicon, titles, icon | `app/assets/favicon.svg`, title "Chowk, a survey of central Bengaluru" | ours |
| OG image | not made | **open** |

Two preflight items are open and both are user actions: a privacy page, and
the checks table in `brand.md` (trademark, domain, handles). Nothing goes live
before them.

## Production

There is no database, no server logic and no secrets. The app is static
files: `app/` plus the data in `app/data/`. That removes most of this section.

- [ ] host: any static host, or a small VPS running `python3 -m http.server`
      behind a reverse proxy. Needs `gzip` or `br` on `.json` and `.woff2`.
- [ ] cache headers: hashed-in-code assets are not hashed, so serve
      `app/data/*.json` with a short max-age and the JS with a short max-age
      too, or add a content hash to file names at deploy time.
- [ ] MIME types: `.json` must be `application/json`, `.woff2` must be
      `font/woff2`. A mis-set font type means the serif does not load.
- [ ] Stripe: not wired into the app. The free tier needs no payment. Create
      the products in `pricing.md` only when the field kit is actually built.
- [ ] analytics: a self hosted counter, no cookie, no third party script. To
      be added before launch.
- [ ] error tracking: optional, and only if it sends nothing about a person.

## Domain

Chosen host and domain are the user's. The shape is:

```
A     @            <host ip or ALIAS value>
CNAME www          <host provided name>
TXT   @            v=spf1 -all          (no email is sent from this domain yet)
```

DKIM and DMARC only once email exists. If the app stays a static site with no
email, `v=spf1 -all` and `p=reject` are the honest records: it says this
domain sends nothing.

HTTPS is required: the app uses `navigator.clipboard` for the share actions
and the Web Share API, both of which need a secure context.

## Watch

- [ ] uptime check on `/index.html` and on `/data/places.json`
- [ ] a visual check of the first load after each deploy: the map, a route,
      the field card export
- [ ] the core flow on a real phone, not a desktop resized to a phone
- [ ] check the served bundle size: 344 KB of JSON plus 58 KB of fonts. If a
      host adds a compression step that breaks the `.json` files, the app
      shows its load failure message, which is the thing to look for.

## Rollback

Static files, so rollback is the previous release directory plus a symlink
flip. Keep the last three. The data files and the app must be released
together: `app/data/meta.json` names the fields the code expects.

## Things that will bite on a real host

1. **Opening `index.html` directly from disk.** ES modules and `fetch` do not
   work on `file://`. The app prints a message telling you to run a local
   server; do not "fix" that message away.
2. **A CDN that rewrites or minifies the JSON.** It is read straight into
   memory and indexed; any transformation breaks it.
3. **A host that blocks fonts by extension.** The page then falls back to
   Georgia and system UI. It still works, but the identity is the serif.
4. **A host that injects analytics.** That would contradict the privacy line
   on the landing page. Turn it off.
