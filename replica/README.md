# Chowk

A clean room rebuild of the Google Maps web loop for central Bengaluru, plus
what its users keep asking for: a map that says how loud a street is, keeps
your places, and never sells you a detour.

**Open the app:** `app/index.html`, over any static server. Live in this
workspace at `http://127.0.0.1:8000/` (the running server serves `app/`).
**Landing page:** `app/launch.html`.

```
cd app && python3 -m http.server 8000
```

ES modules and `fetch` need a server; opening the file from disk will not work
and the app says so.

## What was built with the pack

| folder | what it holds | tool that produced it |
| --- | --- | --- |
| `recon.md` | screens, flows, components, data model, out of scope | replica-recon |
| `features.csv` | 38 features, parity matrix | replica-recon, replica-diff |
| `parity.md` | score, 100.0, must-haves 11/11 | replica-diff |
| `architecture.md` | module map, decisions, data flow, cost | replica-architect |
| `design/` | tokens for 3 themes, component specs, contrast report | replica-design |
| `entrepreneur/` | 22 real public reviews with links, themes, `feedback.md` | replica-entrepreneur |
| `fixes.md` | what users hate, what is missing, fix plan, angle | replica-entrepreneur |
| `brand.md`, `brand.json` | name, checks, palette, logo brief, voice, sweep | replica-brand |
| `test-plan.md`, `bugs.md` | 44 cases, 10 fixed bugs, open to-checks | replica-test |
| `launch/` | landing copy, pricing, store listing, launch plan | replica-launch |
| `deploy.md` | preflight results, host notes, rollback | replica-deploy |
| `clone-screens/` | screenshots of the built screens | replica-build |

## The app

- Canvas vector map drawn from OpenStreetMap data, no tiles, no network after
  load. 395 streets, 566 places, 69 parks, 878 buildings, 2 metro lines.
- Search with word boundaries, categories and cuisine tags; place sheets with
  hours, access, contact and the OSM record.
- Directions for walk, cycle, drive and metro with quiet, step free and
  shortest options, fares, fuel, steps, and a noise comparison.
- Saved lists, notes, export and import, fixes layer, calm score, field card
  export, themes, list view, measure, command palette, keyboard, print.
- 7,300 lines of JS, CSS and HTML. 344 KB of JSON. 16.7 ms frames.

## What it deliberately does not do

Street view, satellite imagery, live traffic, ratings and review text, photos,
popular times and real time transit. Those are licensed content or the
original's own data, not features. `features.csv` records each as a skip with
the reason, and the app says what it does not know rather than guessing.

## Verification

```bash
node tools/check.mjs                                     # data, search, routing, transit: 27 checks
python3 -m unittest discover -s tests                     # the pack's own tests, 57 pass
python3 replica-diff/parity.py replica/features.csv        # 100.0
python3 replica-design/contrast.py replica/design/tokens.json   # 0 AA failures
python3 replica-brand/sweep.py app --config replica/brand.json  # clean
python3 replica-launch/listing.py replica/launch/listing.json   # 0 issues
python3 replica-entrepreneur/reviews.py replica/entrepreneur/reviews.csv \
  --themes replica/entrepreneur/themes.json                 # feedback, every quote linked
```

Data provenance and rebuild: `tools/build_dataset.py`, `tools/data/SOURCE.txt`.
Map data OpenStreetMap contributors, ODbL 1.0. Metro line order adapted from a
public OSM ingestion project, credited in `tools/data/metro_source.json`.
