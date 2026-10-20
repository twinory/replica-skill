# Architecture: Chowk

A static map app. No build step, no framework, no server logic, no account.
Open `app/index.html` over any static file server and it runs.

## Shape

```
app/
  index.html          shell: masthead, panel, canvas, map chrome, modal root
  css/
    tokens.css        colours, type, spacing, radii, shadows, 3 themes
    app.css           the only stylesheet with layout rules
  js/
    geo.js            metres, bearings, formatting, escaping, ids, hashing
    proj.js           spherical Mercator camera, fit, zoom around a cursor
    icons.js          one <svg> sprite object, Path2D cache, 12 categories
    data.js           loads JSON, indexes it, search, category counts
    graph.js          Router: A star over roads, four travel modes, costs
    transit.js        metro trips from line order, interchange, fare
    place.js          opening_hours parser, open state, address strings
    render.js         canvas map: roads, areas, labels, heat, routes, hits
    store.js          localStorage: saved, notes, settings, fixes, tour
    fixes.js          the fixes layer and the quiet score estimates
    panel.js          every panel view, pure strings
    card.js           the field card, drawn on a canvas at 2x
    app.js            boot, camera, draw loop, actions, modals, keys
  data/
    meta.json         bounds, counts, classes, field names
    roads.json        ways with class, name, geometry, grade, noise
    areas.json        parks, water, buildings as polygons
    places.json       points of interest, one per named thing
    graph.json        routed nodes and edges, already split at junctions
    metro.json        two lines, station order, interchange
  assets/             favicon, two variable fonts with their OFL licences
tools/
  build_dataset.py    rebuilds app/data from tools/data/*.osm and metro source
```

7,300 lines of JavaScript, CSS and HTML. 344 KB of JSON, 58 KB of it font
files. The whole app is smaller than one Google Maps map tile bundle.

## Decisions

**No framework.** The panel is a function of state that returns a string, and
`render()` replaces its innards. A diffing framework would add a dependency
and a build step to save a millisecond on a panel that renders in under 2 ms
(this was measured, see the test plan). The canvas is not reactive at all.

**No tiles.** The map is drawn from polygons on every frame. Roads are
projected once per zoom into a Path2D, then culled against the viewport and
stroked in one pass per road class. This is why a pan is 16.7 ms and why the
app works with no network after the first load.

**Data is built, not fetched.** `tools/build_dataset.py` reads a 2.7 MB
OpenStreetMap export once and writes six JSON files. Nothing at runtime calls
a geocoder, a routing service or a tile server. Attribution to OpenStreetMap
contributors is owed for the data and is shown in the map corner, the place
panel and every exported card.

**State lives in one object.** `store.js` owns `{saved, groups, notes,
settings, recents, fixes, contacts}` and writes through to localStorage under
one key (`chowk.v1`), debounced. There is no server, so "sync" is a JSON file
you export and import. That is honest and it is the feature users asked for.

**Routing is a real graph, not a straight line.** Nodes are junctions, edges
are road segments with length, class, oneway and a noise grade. A star runs
with a cost function per mode. Drive, walk and cycle differ by speed, access
and whether oneway applies. Quiet mode adds a noise multiplier. Step free mode
filters edges tagged with steps. Metro is a separate small graph with a
walking leg at each end and an interchange penalty at Majestic.

## Modules and their contracts

| module | exports | depends on | pure |
| --- | --- | --- | --- |
| geo | haversine, bearing, format*, escapeHtml, debounce, uuid | none | yes |
| proj | Camera (project, unproject, fit, zoomAt, pan, cover, clamp) | geo | yes |
| icons | icon(name, size), CATS, CAT_ORDER, catMeta | none | yes |
| data | loadWorld(urls), placesById, byCat, roadGroups, metroByName, searchWorld, categoryList | geo, icons | yes |
| graph | Router, components | geo, data | yes |
| transit | transitOptions | graph, data | yes |
| place | openState, addressLines, kindLine, hoursTable | none | yes |
| render | MapRenderer: draw, hitTest, roadAt, pixel | proj, icons, geo | mostly |
| store | getState, save, settings, notes, fixes, groups | none | no |
| fixes | quietScore, quietLabel, guideNote, ISSUES | geo, store | no |
| panel | one exported function per view | all of the above | yes |
| card | drawCard, CARD_ACCENTS | proj, data, place | mostly |
| app | boot, render, onAct, modals, keys | everything | no |

Views are pure functions of `(view, app, state)`. `app.js` is the only module
that mutates and the only one that touches the DOM by selector. That split is
why the panel can be tested in Node with no browser.

## Data flow

```
boot -> fetch 6 json -> loadWorld() builds Maps -> Router built lazily per mode
     -> Camera.fit(bounds) -> render(panel) -> draw(canvas)

keystroke -> onInput -> searchWorld() -> resultsView() -> render()
click     -> onAct(name, data) -> mutate app.view / store -> render() + draw()
resize    -> coverCamera(camera, panelWidth) -> draw()
```

`draw()` is coalesced with requestAnimationFrame. `render()` is called only on
state change, not on camera movement, so panning never re-renders the panel.

## Boundaries

- Served statically. There is no server route, no API key and no secret.
- The dataset covers central Bengaluru only, [77.5898, 12.9707] to
  [77.6112, 12.9819]. Outside the bounds there is no data and the app says so.
- Fonts are bundled, not fetched. The preview iframe has no network and the
  app must work in it.
- localStorage is the only persistence. Private mode means nothing persists
  and the app warns once.
- The field card draws to an offscreen canvas at 2x and exports a PNG. No
  image leaves the browser.

## Cost

First load: 6 JSON requests, 344 KB uncompressed, 2 font files. Time to
interactive on a warm local server under 400 ms. The largest cost is the
first `draw()` at fit zoom, about 40 ms, because every road path is built
once; after that a frame is 16.7 ms.
