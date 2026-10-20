# Test plan: Chowk

Build: working branch `arena/198b28c2-replica-skill`  Date: 2026-10-20
Env: local, static server on port 8000, Chromium 153 headless, seed data from
`app/data/`. Flow ids are the ones in `recon.md`.

Method: the app has no test runner and no build, so the automated pass is a
headless Chromium script driving the real UI (puppeteer-core), plus Node
scripts that import the pure modules directly. Every run fails the suite on a
console error or an uncaught page error. Screenshots for each step are kept
outside the repo; findings are in `bugs.md`.

| case | flow | type | steps | expected | auto | result |
| --- | --- | --- | --- | --- | --- | --- |
| F01-H1 | find a place | happy | focus search, type "hard rock", Enter | place panel for Hard Rock Cafe, map flies to it | browser | pass |
| F01-E1 | no match | edge | type "zzzz" | "No match in the survey", clear button, no error | node + browser | pass |
| F01-E2 | long input | edge | 120 characters | no layout break, no crash | browser | pass |
| F01-E3 | accents and case | edge | "KOSHYS", "koshy's" | both find Koshy's | node | pass |
| F01-E4 | category word | edge | "cafe" | cafe places, plus "Browse all 20 cafes" | node | pass |
| F01-E5 | cuisine word | edge | "chinese" | 7 restaurants that serve Chinese food, not only names | node + browser | pass |
| F01-E6 | road and station | edge | "mg road" | MG Road station first, road and parade ground after | node | pass |
| F01-E7 | keyboard only | edge | `/`, type, Down, Enter | first result opens, focus stays visible | browser | pass |
| F02-H1 | walk somewhere | happy | place panel, Directions, Map centre as start | 1 route card, steps, noise block | browser | pass |
| F02-E1 | same start and end | edge | Directions on the place you are at, start = centre | "Same spot", no route card, no 0 m route | browser | pass |
| F02-E2 | no walking path | edge | drop a pin outside the surveyed network | "No walk route inside the survey" | node | pass |
| F02-E3 | mode switch | edge | walk, cycle, drive, metro in a row | each re-solves, no stale steps | browser | pass |
| F03-H1 | compare modes | happy | drive, move the hour slider to 9:30 | duration and fuel change, "typical weekday pattern" note | browser | pass |
| F03-E1 | quiet route | edge | choose the quieter option | noise falls, time rises or holds, noise bar moves | node | pass |
| F03-E2 | step free | edge | toggle step free only | routes without steps, place filter narrows | node | pass |
| F03-E3 | metro with a change | edge | stadium to Vidhana Soudha | one line, 21 min, fare shown, no duplicate option | node | pass |
| F03-E4 | absurd transit | edge | two points 400 m apart | metro is not offered as a 35 minute option | node | pass |
| F04-H1 | save a place | happy | place panel, Save, add to Weekend | badge Saved, row in Saved view | browser | pass |
| F04-E1 | empty saved | edge | open Saved with nothing saved | "Nothing saved yet" with the offline line | browser | pass |
| F04-E2 | note persistence | edge | type a note, reload | note still there, "Saved just now" before reload | browser | pass |
| F04-E3 | notes list | edge | save two notes | "Notes you wrote" section lists both | browser | pass |
| F04-E4 | export | edge | Settings, Export my data | chowk-export.json downloads, toast "Exported" | browser | pass |
| F05-H1 | measure | happy | right click, Measure distance, two taps | line with a distance label, Esc clears | browser | pass |
| F05-E1 | measure one point | edge | one tap only | no label, no error | browser | pass |
| F06-H1 | layers | happy | Layers, Quiet streets | noise ramp on roads, row checked, trunk roads differ from lanes | browser | pass |
| F06-E1 | layer persistence | edge | toggle, reload | choice persists in localStorage | browser | pass |
| F06-E2 | pixel map | edge | Layers, Pixel map | coarse blocks, marker still clickable | browser | pass |
| G01 | place card | happy | place panel, Card, Download PNG | 1520 square PNG, correct title and note | browser | pass |
| G01-E1 | card accents | edge | pick ink and rose | ground, ink and rules all change | browser | pass |
| G02 | themes | happy | T three times | light, dark, contrast; AA pairs hold | browser + python | pass |
| G02-E1 | reduced motion | edge | emulate prefers-reduced-motion | transitions 0 ms | not run | todo |
| G03 | list view | happy | Shift L | text table of every place, Esc closes | browser | pass |
| G03-E1 | list view keyboard | edge | Tab through the table | every row reachable, focus ring visible | not run | todo |
| G04 | mobile layout | happy | 390 by 844 | map above, panel as a sheet, sheet expands | browser | pass |
| G04-E1 | mobile sheet | edge | tap the handle | sheet grows, map controls hide | browser | pass |
| G05 | print map | happy | palette, Print the map | new window with the still map, centre and attribution | browser | pass |
| G05-E1 | print dialog blocked | edge | pop up blocked | toast "Allow pop ups to print the map" | browser | pass |
| G06 | offline load | edge | stop the server, reload | "Chowk could not load its survey" with the local server hint | browser | pass |
| G06-E1 | localStorage off | edge | block storage | app still runs, save shows an error, no crash | not run | todo |
| G07 | boot with empty data | edge | serve an empty places.json | app loads, counts 0, no crash | not run | todo |
| P01 | frame time | perf | 60 drag frames, median | under 25 ms at 1440 by 900 | browser | pass, 16.7 ms |
| P02 | route solve | perf | 20 drive and 20 transit solves | under 500 ms total | node | pass, 21 ms and 16 ms |
| A01 | contrast | a11y | every text pair, three themes | AA everywhere | python | pass, 0 fail |
| A02 | screen reader labels | a11y | buttons and inputs named | every interactive element has a name | manual spot check | pass |
| A03 | focus order | a11y | Tab from the top | masthead, search, chips, panel rows, map | not run | todo |

Counts: 44 cases, 38 automated and passing, 6 marked not run and listed as
"to check" rather than claimed.

What is not covered: real touch devices, Safari, Firefox, a screen reader
other than the accessibility tree, print output on real paper, and any route
outside the surveyed bounds.
