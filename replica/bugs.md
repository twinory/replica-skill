# Bugs

Every entry was reproduced in the running app, fixed, and re-checked. Build:
`arena/198b28c2-replica-skill`, Chromium 153 headless at 1440 by 900 unless the
entry says otherwise. Evidence paths are outside the repo, in the QA harness
that produced them.

### BUG-001: ReferenceError on boot, a blank map

- Severity: S1
- Flow / case: every flow
- Screen: S01
- Build: the culling change

Steps
1. Load the app.
2. Watch the console.

Expected: the map draws.
Actual: `Identifier 'view' has already been declared`, boot stops, the panel
stays a skeleton.
Evidence: console error, skeleton screenshot.
Suspected cause: the viewport culling rewrite declared `const view` inside
`draw()` where `view` was already a parameter.
Status: fixed, the bounds are now `vb`.

### BUG-002: Scale bar frozen at 200 m

- Severity: S3
- Flow / case: S01 zoom
- Screen: S01

Steps
1. Load the app.
2. Zoom in six steps with the wheel or the plus button.

Expected: the bar recomputes, 100 m, 50 m, 25 m.
Actual: it says 200 m at every zoom, at a fixed 60 px.
Evidence: six readings of `#scale-text`, all "200 m".
Suspected cause: two. The element had no `id="scale"`, so `updateScale()`
returned early on a null lookup; and the scale step picked the largest round
number *below* the target width, so the bar was usually a stub. Both fixed:
the id is on the element, and the step now picks the nearest round number by
ratio with a minimum width.
Status: fixed, readings now 100/50/50/25/25/20/10 m across zooms.

### BUG-003: "cuisines is not defined" when opening a place with a cuisine tag

- Severity: S2
- Flow / case: F01-H1
- Screen: S04

Steps
1. Search "rice bowl".
2. Enter or click the result.

Expected: the place panel.
Actual: the panel throws `cuisines is not defined`, the click appears to do
nothing, console error.
Evidence: console error, panel unchanged.
Suspected cause: a rewrite of the place header removed the local
`const cuisines = cuisineList(place)` while the facts table still used it. The
module passed `node --check` because the reference is legal JavaScript.
Status: fixed, the declaration is back above the template.

### BUG-004: Duplicate route summary, a second card with no name

- Severity: S3
- Flow / case: F02-H1
- Screen: S05

Steps
1. Right click the map, "Go here".
2. Start from Map centre.

Expected: one route card, then the noise block, then the steps.
Actual: a second card with a big "1 min" and "100 m", no label, above the
noise block, repeating the first card.
Evidence: screenshot, DOM shows `.summary-strip` then `.route-options`.
Suspected cause: a summary strip added before route options duplicated what
the card already says.
Status: fixed, the strip is removed.

### BUG-005: 0 m route when start and destination are the same

- Severity: S3
- Flow / case: F02-E1
- Screen: S05

Steps
1. Open a place, Directions.
2. Use the map centre as the start while the place is at the centre.

Expected: "Same spot", no route.
Actual: a "fastest" 1 min, 0 m route card, and a route drawn as a dot.
Evidence: screenshot.
Suspected cause: the same-spot check lived in the view but not in the
`computeRoute` action, so a route object still existed.
Status: fixed, the action clears the route under 20 m, and the view hides the
cards.

### BUG-006: Toast covers the attribution line

- Severity: S4
- Flow / case: F05-H1
- Screen: S01

Steps
1. Press M to measure.

Expected: the toast sits clear of the map footer.
Actual: "Tap the map to measure distances" overlapped the OpenStreetMap
attribution by about 20 px.
Evidence: measured rects, toast at y 837 and attribution at y 861 in a 900 px
window.
Suspected cause: the toast was bottom-anchored at 26 px with no allowance for
the 23 px attribution bar.
Status: fixed, bottom is 58 px, and on mobile it clears the sheet.

### BUG-007: Map print button opened a blank pop up

- Severity: S3
- Flow / case: G05
- Screen: S01

Steps
1. Palette, "Print the map".

Expected: a print window with the map.
Actual: nothing. No console error.
Evidence: the mocked `window.open` was never called.
Suspected cause: `printMap()` looked up `#map-canvas`, the canvas is `#map`.
It threw before `window.open`, and the error was swallowed because the palette
call is inside a click handler with no catch.
Status: fixed, the id is corrected; the harness now asserts a 1 MB document
with an inline PNG and the attribution.

### BUG-008: Native clear button doubled up in the search field

- Severity: S4
- Flow / case: F01-H1
- Screen: S02

Steps
1. Type in the search box.

Expected: one clear control, the app's own.
Actual: two X marks, the browser's cancel button and the app's.
Evidence: screenshot.
Suspected cause: `input[type=search]` ships a cancel button in Chromium.
Status: fixed, the native one is hidden in CSS, the real one is a 14 px icon
button with a label.

### BUG-009: Field card title collided with the facts block

- Severity: S3
- Flow / case: G01
- Screen: field card

Steps
1. Open a place with a long name.
2. Card, Download PNG.

Expected: a clean card.
Actual: two line title overlapping the first fact row, a stray ellipsis from
an empty wrapped line.
Evidence: first card PNG.
Suspected cause: a fixed title box height with an unconditional ellipsis.
Status: fixed, the title wraps with the ellipsis applied only when truncated,
the body is a two column fact grid, card height 760.

### BUG-010: Route cards vanished on a slow mobile viewport

- Severity: S3
- Flow / case: G04
- Screen: S05

Steps
1. 390 by 844 device, open a place, Directions.

Expected: route cards.
Actual: blank panel; console `cuisines is not defined` (same as 003).
Evidence: mobile screenshot, console error.
Status: fixed with BUG-003, re-verified on the mobile viewport.

### BUG-011: Quiet layer painted every street the same middling colour

- Severity: S2
- Flow / case: F06-H1
- Screen: S01 with the quiet layer on

Steps
1. Layers, Quiet streets.
2. Look at a trunk road and a residential lane side by side.

Expected: the trunk road in marigold, the lane in green.
Actual: every road the same colour. Routed noise numbers were correct, so the
route comparison worked while the map lied about which streets are loud.
Evidence: a pixel census of the map area showed one bucket where a ramp
should be; after the fix, 147 distinct buckets.
Suspected cause: `roads.json` carries the grade as `z`, and `loadWorld` built
road objects without copying it. The renderer then fell back to 50 for all
395 ways. `node --check` cannot see a missing field, and the route numbers
come from `graph.json` edges, so the bug hid in the gap between two datasets.
Status: fixed, `noise: r.z` on the road object, and `tools/check.mjs` now
asserts that every road has a grade.

## To check, not reproduced

- The scale bar is correct on resize but has not been checked after a
  display-scale change (moving the window between monitors).
- `prefers-reduced-motion` is implemented in CSS but was not exercised with
  an emulated media feature.
- The list view was checked with a mouse and Esc only, not with a keyboard
  traversing every row.
- Transit times are modelled at 125 s per stop plus a 210 s wait. A real trip
  on the Purple line may differ; the number is a stated estimate, not a claim
  of accuracy.
- The walk graph has 628 of 641 nodes reachable, the drive graph 468. The 13
  unreachable walk nodes are surveyed stubs outside the routable network; no
  place in the dataset sits on one, but only the four test pairs were checked.
