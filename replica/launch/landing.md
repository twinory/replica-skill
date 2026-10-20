# Landing page

Built at `landing/index.html` in this repo, a static page with no external
requests. Copy in the brand voice from `replica/brand.md`. Every claim below
is one the app can demonstrate in ten seconds.

## 1. Hero

**Headline:** Route by how a street feels.

**Line under it:** Chowk is a survey of central Bengaluru with a noise grade
on every street. Two routes, two numbers, your pick.

**Button:** Open the survey (links to `../app/index.html`)

**Visual:** the real app, route detail open, noise comparison visible. No
mockups, no invented screenshots. The page uses one of the real screenshots in
`replica/clone-screens/`.

## 2. The problem

Two paragraphs, paraphrased, no reviewer quotes and no counts:

> A map will happily send you down the loudest road in the city, because it is
> forty seconds faster. It has no way to tell you that the lane behind is
> quiet.
>
> And when you save a place, you are trusting a list you cannot search, cannot
> export and cannot take with you when the network drops.

## 3. How it works

Three steps, drawn from the core flow:

1. **Search or tap the map.** Twelve categories, streets, metro stations.
2. **Pick a route.** Walk, cycle, drive or metro. Each option shows time, and
   the noise on the way.
3. **Keep what you found.** Save it, note what you learned, print a field
   card, export the lot.

## 4. Features, fixes first

| section | what it says | why it is there |
| --- | --- | --- |
| Quiet streets | a noise grade on all 395 surveyed ways, a quiet route, a comparison on every route | the biggest complaint in the research |
| Calm score | every place gets 0 to 100 from its street, with the reasons shown | cheap, and it makes the quiet claim visible |
| Fixes layer | report a broken pavement, it stays until someone marks it fixed | the safety half of the same complaint |
| Field card | a printable card with the street plan, score and your note | the shareable artefact |
| Step free | step free routing and a place filter | accessibility as data, not a checkbox |
| Yours to keep | notes, lists, export to JSON, no account, no ads | the saved-places complaint |
| Typical day | a time slider built from a published curve, labelled as an estimate | travel times people can see the logic of |

Then, in a smaller row, the parity features: search, place sheets, hours,
metro with fares, measure, list view, keyboard, themes.

## 5. Pricing

One table, three rows, from `pricing.md`. The free tier first, in plain words:
"the whole map loop, no charge, no account, no ads."

## 6. FAQ

- **Is this the same map?** No. It is drawn from OpenStreetMap data, covers
  central Bengaluru, and is not affiliated with any map provider.
- **Where does the noise number come from?** From the road class and the
  survey notes on each street. It is an estimate, and the app says so.
- **Does it work offline?** Yes, once loaded. The data is local files; your
  places and notes live in the browser.
- **Can I bring my saved places from another app?** Not yet. You can export
  from this one as JSON. Import is on the list, see `replica/fixes.md`.
- **Why is there no star rating?** Because the survey does not have one, and
  inventing one would be the exact thing this project is against.
- **What happens to my data?** It stays in your browser. Delete it in
  Settings, one click.

## 7. Final call

**Button:** Open the survey
**Under it:** 566 places, 395 streets, two metro lines. Central Bengaluru,
from the data up.

## Notes for whoever builds it

- No testimonials. There are no users yet, and inventing proof is banned in
  this pack and by law in several countries.
- No "trusted by", no star row, no press logos.
- The one image is a real screenshot with the real app.
- Run `python3 replica-design/contrast.py replica/design/tokens.json` before
  publishing a palette change, and check the page with the contrast theme on.
- The page must not make a single request to a third party: the preview
  iframe this project is shown in has no network.
