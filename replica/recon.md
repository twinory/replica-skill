# Recon map: Google Maps (web app)

Scope: the core web loop. Search for a place, read the place panel, get
directions, and keep places. Plus the map chrome around it: layers, zoom,
scale, keyboard and the saved list.
For: a local first map of central Bengaluru that adds what Google Maps will not.
Date: 2026-10-20

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | product, public | https://www.google.com/maps | live web app, read signed out at human speed |
| 2 | help centre, directions | https://support.google.com/maps/answer/144339 | modes, route options, steps |
| 3 | help centre, saved lists | https://support.google.com/maps/answer/7280933 | lists, labels, share a list |
| 4 | help centre, layers | https://support.google.com/maps/answer/3360997 | traffic, transit, terrain, satellite |
| 5 | help centre, keyboard shortcuts | https://support.google.com/maps/answer/3085 | the key map, used for S01 states |
| 6 | help centre, offline maps | https://support.google.com/maps/answer/6291838 | what works without a connection |
| 7 | accessibility help | https://support.google.com/maps/answer/6396990 | screen reader behaviour, list view |
| 8 | public app listings | App Store and Play Store listing pages | screenshots of every key screen |
| 9 | user feedback | see `replica/entrepreneur/reviews.csv` | 18 public threads, links on every row |

No account was used, nothing signed in, no JavaScript bundles read, no
private endpoints recorded. Public pages only. Each finding below cites the
source number it came from.

## Core loop

Type a destination, see where it is, read what is there, and go. Everything
else in the product hangs off that one loop.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Map canvas | https://www.google.com/maps | the map itself, pan, zoom | canvas, zoom control, scale bar, compass, attribution, keyboard focus | empty area, dense city, zoomed out with few labels, zoomed in with buildings, loading, keyboard focus ring |
| S02 | Search box | top left of S01 | find a place, category or address | input, clear, suggestions, recent, category chips | empty, typing, results, no results, permission denied for location |
| S03 | Search results list | after a search | choose from candidates | list, distance, rating, open state, filter chips | few results, many results, none, filter open |
| S04 | Place panel | click a marker or result | decide whether to go | name, category, rating, hours, address, actions row, photos, reviews, popular times | open, closed, no hours, no reviews, long name, photo missing |
| S05 | Directions panel | Directions on S04, or the directions button | plan a trip | two fields, swap, mode tabs, route options, steps, depart time | walking, driving, cycling, transit, no route, route loading |
| S06 | Route on map | after S05 | see the shape of the trip | coloured line, alternatives in grey, start and end pins, steps | selected route, alternative selected, off route |
| S07 | Saved | Saved tab | keep places in lists | lists, items, quick save, notes on items | empty, one list, many lists, shared list |
| S08 | Layers menu | bottom left button | switch data on the map | traffic, transit, terrain, satellite, street view, wildfire | each layer on and off |
| S09 | Street view | pegman | look at the street | panorama, compass, arrows, exit | limited coverage, no coverage |
| S10 | Context menu | right click a point | act on a point | what is here, directions, measure, report a problem | on a road, on a place, on empty land |
| S11 | Settings | menu | units, themes, language, privacy | radio rows, toggles | each theme |
| S12 | Offline maps | settings | download an area | area list, download, storage meter | downloading, downloaded, expired |

Screens S09 and S12 are recorded for parity but are out of scope, see below.

## Flows

```
F01 Find a place and look at it
    S01 -> S02 (type) -> S03 -> S04
    happy path clicks: 4 (focus, type, pick, read)
    edge: no match, offline, ambiguous name, two branches of one chain

F02 Go somewhere on foot
    S01 -> S02 -> S03 -> S04 -> S05 (walk) -> S06
    happy path clicks: 6
    edge: same start and end, point outside coverage, no walking path

F03 Compare modes
    S05 -> switch walk, cycle, drive, transit -> S06
    happy path clicks: 1 per mode
    edge: no transit nearby, longer than an hour, late night

F04 Keep a place for later
    S04 -> Save -> pick a list -> S07
    happy path clicks: 3
    edge: no lists yet, duplicate save, offline save

F05 Measure a distance
    S01 -> right click -> Measure -> tap two points
    happy path clicks: 4
    edge: third point, undo

F06 Change the map layer
    S01 -> S08 -> pick a layer -> S08 -> off
    happy path clicks: 3
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | filled, outline, text, icon, icon circle | default, hover, active, focus visible, disabled | all |
| Search input | with icon, with clear, with shortcut hint | empty, focused, filled, error | S02 |
| Chip | category, filter, saved list | default, selected, pressed | S02, S03, S05 |
| List row | place, street, station, saved item | default, hover, selected, with note | S03, S07 |
| Place panel | summary, expanded | open, closed, unknown hours | S04 |
| Action row | three to four actions | default, saved, active | S04 |
| Route card | fastest, alternative | default, selected | S05 |
| Step list | turn, continue, arrive, transit leg | current, past, upcoming | S05 |
| Map control cluster | zoom in, zoom out, fit, locate | default, hover, active | S01 |
| Layers menu | checkbox rows with icons | on, off | S08 |
| Context menu | item list | default, hover | S10 |
| Modal | panel, wide, narrow | open, closing | S07, S11 |
| Toast | one line, with icon | shown, leaving | all |
| Skeleton | line, block | loading | S02, S04 |
| Scale bar and compass | horizontal bar, needle | shown, hidden | S01 |
| Toggle and segmented control | switch, two to four options | on, off | S11, S05 |

## Inferred data model

```
Place       id, name, category, subtype, lon, lat, tags (opening hours,
            phone, website, wheelchair, cuisine), osm_ref
            evidence: S03 rows, S04 facts, source 9 threads about listings
            confidence: high

Road        id, name, class, geometry (polyline), oneway, access modes
            evidence: S01 at street level, S05 steps naming streets
            confidence: high

Route       id, origin, destination, mode, depart_at, metres, seconds,
            legs (steps), alternatives, fare
            evidence: S05 route cards and step list, S06 line on the map
            confidence: high for shape, guess for exact cost weights

SavedItem   id, list_id, place_id, note, created_at, shared
            evidence: S07, source 3
            confidence: high

List        id, name, colour, item_count, owner, visibility
            evidence: S07, source 3
            confidence: high

Review      id, place_id, author, rating, text, created_at, photos
            evidence: S04
            confidence: high, out of scope for the clone

User        id, home, work, units, theme, recent
            evidence: S07, S11
            confidence: high
```

Relationships: List 1-n SavedItem, Place 1-n SavedItem, Place 1-n Review,
Route 1-n Step.

The clone withholds ratings, review text, photos, popular times, live
traffic and street view imagery. Those are content and data the original
owns, not features. See `replica/features.csv` rows marked skip.

## Feature matrix

See `features.csv`. Must: 12, should: 8, could: 5, skip: 6.

## Out of scope (cannot or should not be cloned)

- **Street view imagery.** Photographs of every street, owned and licensed.
  Replaced with a field card: text and a drawn street plan for a place.
- **Live traffic.** Google's own probe data from its users. Replaced with a
  published peak hour curve, labelled as an estimate, not live.
- **Ratings, review text and photos.** User generated content, not a feature.
  The clone has no star ratings and says so, rather than faking them.
- **Popular times and busyness charts.** Derived from Google's location
  history. Replaced with a busy layer built from place density and hours.
- **Places data as a service.** The Places API, the business database and its
  freshness. Rebuilt from an OpenStreetMap extract, which is open and
  attributable, at the cost of coverage.
- **Transit real time.** Live departure boards need the operator's feed.
  The clone schedules metro trips from published line order and fare bands.

## Size

Screens 12 (10 built), flows 6 (6 built), entities 7 (5 built). Hard parts:
the routing graph with realistic costs, a labelling engine that stays legible
at four zoom levels, and transit trips across two lines with an interchange.
Size: L. The base map alone is a quarter. The panel and flows are a few weeks.
