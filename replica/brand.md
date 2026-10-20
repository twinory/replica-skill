# Brand: Chowk

A clean room rebuild of the map loop, renamed, recoloured and rewritten before
anyone outside this repo sees it.

## Name

**Chowk** (rhymes with joke). A chowk is the point where streets meet, the
square a neighbourhood is named after. It is a real word in Hindi, Urdu and
Marathi, spelled the same way in all three, and it is what the app is: a
junction you can read.

Made against the angle in `fixes.md`: "Chowk routes you by how a street feels,
not just how fast it moves."

Shortlist that lost: Sadak (road, too plain, and a common word), Gali (lane,
cute but tiny), Naka (junction, but police checkpoint in some regions),
Raste (routes, generic), Chowkadi (junction, but means crossroads in a way
that reads as indecision in Kannada).

### Checks

Screening only, run as a person in a browser. These are not legal clearance.

| check | where | result |
| --- | --- | --- |
| US trademark, class 9 and 42 | tmsearch.uspto.gov | to run |
| EU trademark | euipo.europa.eu eSearch | to run |
| Canada | ised-isde.canada.ca | to run |
| global | WIPO Global Brand Database | to run |
| domain | whois chowk.app, chowk.in, chowk.co | to run, the user buys it |
| App Store and Play | search the exact name | to run |
| handles | X, Instagram, TikTok, GitHub | to run |
| the web | search "Chowk map" | to run |

Why they are marked to run: this workspace has network access to GitHub, npm
and the public web pages only, and no registrar or trademark API. Writing
"available" for a check nobody ran would be a lie, so it stays "to run" until
the user runs it. Nothing is bought in this repo.

## Palette

The original is blue and white with saturated pins. Chowk is warm paper and
forest ink, so no neighbouring hue, no shared surface treatment.

| role | value | why |
| --- | --- | --- |
| bg | #f3eada | warm paper; the map is paper too, so the panel never fights it |
| surface | #fffcf4 | cards read as a sheet laid on the paper |
| text | #1b1815 | ink, not black |
| text-muted | #6d6152 | 5.1:1 on bg |
| accent | #0b6e4f | forest, the only saturated colour at rest |
| accent-soft | #dcebe0 | selected rows, summary strips |
| marigold | #b03a0a | reserved for the fixes layer and busy markers, never decoration |
| danger | #a62a1e | closed, removed |
| map park | #cedebb | |
| map water | #afd3db | |
| map route | #0b6e4f | the route is the brand colour, once |

Contrast: `python3 replica-design/contrast.py replica/design/tokens.json` gives
15 pairs, 0 failing AA. The marigold value was darkened from #c2410c to
#b03a0a during this step because the first value failed on bg at 4.34:1.

Dark and high contrast themes are in `app/css/tokens.css`. Every theme pair
was measured: dark text 16.1:1, muted 8.0:1; contrast theme 21:1 and 17.4:1.

## Logo brief

- The idea: a junction you can read. Two lines meeting at a point that is also
  a pin.
- Mark type: symbol plus wordmark. The symbol is the rounded square tile with
  a pin inside, which is what the favicon and app icon use.
- Must work at 16px as a favicon and at 1024px as an icon with no transparency
  for iOS.
- Deliverables: SVG source, 1024 app icon, favicon set (16, 32, 180), social
  image 1200 by 630.
- Must not resemble the original's mark: no teardrop pin with a hole, no
  four-colour scheme, no shared letterform. Put the two side by side and check
  at 32px.
- Existing draft: `app/assets/favicon.svg`, a forest tile with a cream pin and
  a marigold rule at the base. It is a placeholder, not a finished identity.

## Voice

Three words: **plain, precise, local.**

- Plain, not blunt. "Hours not listed" rather than "Unknown".
- Precise, not technical. "44 of 100, busy" rather than "noise index 0.44".
- Local, not cute. "Bengaluru" spelled the way the city spells it, streets
  named as the signs name them.

Do and do not:

| do | do not |
| --- | --- |
| "The lane behind is calmer than the main road entrance." | "Pro tip! You won't believe this hidden gem." |
| "Times use a typical weekday pattern, not live traffic." | "Real time routing." |
| "No match in the survey. Try a street name." | "Oops! Nothing here!" |
| "Saved just now" | "Synced to the cloud" |
| "This browser only. Export it if you want a copy." | "Your data is safe with us." |

Ten most seen strings, rewritten in this voice (all live in the app):

1. Search placeholder: "Search shops, streets, stations"
2. Empty results: "No match in the survey"
3. Save action: "Save", then "Saved"
4. Note hint: "What did you find? The queue, the step at the door, a better entrance."
5. Note status: "Saved as you type", then "Saved just now"
6. Directions empty: "Pick two points"
7. Same spot: "The start and the destination are the same place."
8. Load failure: "Chowk could not load its survey"
9. Export toast: "Exported", file named chowk-export.json
10. Footer: "566 places surveyed" and "OpenStreetMap, ODbL"

None of these echo the original's phrasing: no "Explore", no "Your places",
no exclamation marks anywhere in the app.

## Sweep

```
python3 replica-brand/sweep.py app --config replica/brand.json
python3 replica-brand/sweep.py tools --config replica/brand.json
```

Both report clean. The sweep is run on the product (`app/`, `tools/`), not on
the skill pack, whose own files mention Google Play and review sites on
purpose and are never shipped to a user.

Two patterns were removed from `brand.json` after checking why they fired:
`g.co` matched `${g.color}` and `Alphabet` matched the canvas keyword
`alphabetic`. Neither is a brand leftover. `google.com`, `maps.google.com`,
`goo.gl`, the product name and the original palette are still checked, and
none of them appear.

Also checked by eye: the favicon, the page title ("Chowk, a survey of central
Bengaluru"), the empty states, the field card footer, and the map attribution
(OpenStreetMap, which is a licence obligation and is not the original).
