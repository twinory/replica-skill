# Fixes: what the original's users hate, and the angle for Chowk

Sample: 22 public threads, 1 source (Reddit), 0 with star ratings. That is a
small sample. It supports a direction, not a ranking, and the theme table marks
every theme thin for exactly that reason. Quotes are verbatim and linked in
`feedback.md`, generated from `reviews.csv` by `reviews.py`. Nothing here is
paraphrased into a fake quote, and nothing here is a testimonial.

## 1. What they hate

Ranked by weighted score from `feedback.md`. Every theme is thin (one source).

| # | problem, in one line | reviews | sources |
| --- | --- | --- | --- |
| 1 | Routes that are wrong, slow or unsafe, and times that make no sense | 8 | 1 |
| 2 | Saved places and lists that vanish or cannot be found again | 6 | 1 |
| 3 | Ads in the map, in search, and mid navigation | 5 | 1 |
| 4 | Controls that move or hide while driving | 3 | 1 |
| 5 | Too many taps and steps to do a simple thing | 2 | 1 |
| 6 | Updates that make the app worse | 1 | 1 |
| 7 | Offline that does not actually work | 1 | 1 |

The two quotes that set the direction:

- Routes: "Getting real tired of Google suggesting a 43 minute route that
  changes to 14 minutes when I force it to go a different way."
- Saved: "The saved places are still there but search does not find them. It
  still works with a few extra clicks, but it is pretty annoying."

## 2. What is missing

| # | asked for | reviews | sources |
| --- | --- | --- | --- |
| 1 | Walking, cycling and transit that work offline | 4 | 1 |
| 2 | A way to export or back up saved lists | 1 | 1 |

Reading the raw list, the real request behind both is the same: "keep my
places, and let me use them when the network is gone".

## 3. What is unsolved

1. **The map as a place you can study, not only a place you can obey.** Every
   complaint about routes is about a machine deciding for you. Nobody offers a
   map that shows *why* one street is calmer than another, or lets you plan by
   how a street feels rather than only how fast it moves you.
2. **Accessibility as data, not a filter checkbox.** Step free is a tag in
   most apps and a gamble in practice. Nothing says "the side gate is step
   free, the main entrance is not" and keeps it current.
3. **Trust that the route is not for sale.** Once ads enter navigation, a
   detour is never just a detour. A map with no advertising and a stated,
   inspectable cost model is a different product, not a cheaper one.

## 4. Fix plan

Sized by evidence times how cheaply it can be fixed. Each is a row in
`features.csv` with `original` set to `no`.

| # | build | size | skill | evidence |
| --- | --- | --- | --- | --- |
| 1 | Quiet streets layer: per segment noise grade, noise weighted route, noise comparison on every route | M | build | 8 route complaints, 1 thread explicitly asks for a route that does not send you through random neighbourhoods |
| 2 | Fixes layer: report a broken pavement or unsafe crossing, it stays on the map until marked fixed | M | build | 8 route and safety complaints; two threads describe illegal or dangerous manoeuvres |
| 3 | Calm score on every place, from its street, with the reasons shown | S | build | same theme, cheap because the noise grade already exists |
| 4 | Field card: a printable PNG with the street plan, calm score and your own note | S | build | "keep my places" plus "what is it actually like" in one artefact |
| 5 | Step free routing and a step free place filter | M | build | 12 places carry a wheelchair tag in the survey; the filter is the honest version of a feature the original has |
| 6 | Local notes on saved places, searchable, stored in this browser | S | build | 6 saved-place complaints, one directly about not being able to search them |
| 7 | Export and import of saved places and notes as JSON | S | build | 1 explicit request; also the answer to the lost lists thread |
| 8 | Time of day slider that changes drive times from a published curve, labelled as an estimate | S | build | 2 threads say travel times make no sense; showing the curve is more honest than hiding it |

All eight are built. The rows are in `features.csv` under "new:" areas.

## 5. The angle

Three options, each grounded in a theme.

**A. The calm route.**
For people who walk and cycle a city and are tired of being routed down the
busiest road because it is thirty seconds faster, Chowk picks the quiet street
and shows you the noise on every option.
Evidence: routes that are wrong or unsafe, 8 reviews, 1 source.

**B. The map that keeps your places.**
For people who have lost a saved list, Chowk keeps your places in your own
browser, searchable, exportable, and working with no network.
Evidence: saved places and lists that vanish, 6 reviews, 1 source.

**C. No ads, ever, with the cost model in the open.**
For people who no longer trust a detour, Chowk has no advertising, no sponsored
pins and a route cost you can read in the source.
Evidence: ads, 5 reviews, 1 source.

**Recommended: A**, with B and C as supporting claims. Reasons:

- A is the only theme where the clone has a feature the original does not,
  rather than a promise about the absence of one. It is demonstrable in ten
  seconds: open two routes, read the noise numbers.
- A is also the fix for the largest theme by weighted score, and the one the
  data quality supports: the survey carries a graded noise value on all 395
  ways, so the claim is computed, not asserted.
- B and C are cheap to keep true and worth saying, but neither is a reason to
  switch on its own. Nobody changes map apps for a backup button.

One line, to be used in the brand voice and the launch hero:

> Chowk routes you by how a street feels, not just how fast it moves.

Careful with claims: this is one source and 22 threads. Do not put a count of
"thousands of users" anywhere, because there is no such count.
