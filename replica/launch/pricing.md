# Pricing

Read 2026-10-20. Prices for consumer map apps change rarely, but check again
before you publish.

## What the alternatives charge

| app | consumer price | model | URL |
| --- | --- | --- | --- |
| Google Maps | no charge to the user | advertising, plus a paid platform API for businesses | https://www.google.com/maps (read 2026-10-20) |
| Apple Maps | no charge | bundled with the device, some sponsored results now | the built in app |
| Waze | no charge | advertising | the app listing |
| Organic Maps | no charge | open source, donations | the app listing |

The consumer side of this market is free at the point of use. Charging for
the map itself on day one would be a hard sell, and `feedback.md` shows the
top complaint is not price, it is trust: ads and routes that look bought.

## What reviewers said about money

Nothing about price. Zero of the 22 threads are about paying for a map. Five
are about ads, which is the same argument from the other side: people accept
free and resent being sold to inside navigation. That is the opening.

## The model

- **Free, and it stays free for the map loop.** Search, routes, quiet and
  step free layers, saves, notes, export. No ads, ever, including in the
  store listing.
- **One paid tier, sold as a field kit, not a subscription to the map.**
  Extra field cards, printed packs, and a shared team survey. A one time
  purchase per pack, because a monthly bill for a map is exactly the thing
  people in these threads are angry about.
- **Institutions pay.** Schools, accessibility groups and neighbourhood
  associations buy a shared survey with their own fixes layer. That is where
  the revenue is, and it does not touch the free experience.
- **No per seat pricing on the free tier, no trial countdown, no dark
  patterns.** One click to delete everything, in Settings, no email needed
  (there is no account).

## Tiers

| tier | who it is for | price | what you get |
| --- | --- | --- | --- |
| Survey | anyone | no charge | the whole map loop, all layers, saves, notes, export, field card |
| Field kit | one person who prints and shares | ₹499 once | unlimited card packs, 4 inks, A4 print set, note archive import |
| Neighbourhood | a group or institution | ₹4,999 a year | shared fixes layer, custom survey extent, named attribution |

Prices are in INR because the survey is Bengaluru. If it ships elsewhere,
price in the local currency rather than converting.

## Billing rules, so the complaints are not repeated here

- Cancelling is one click, in the app, and works without contacting anyone.
- One email before a yearly renewal, with the amount and the date.
- No price change without a new purchase.
- No card stored for the free tier, because there is no account.

## Stripe objects to create (the user creates them)

| object | value |
| --- | --- |
| product `chowk_field_kit` | Field kit, one time |
| price `price_field_kit_inr` | ₹499, one time, INR |
| product `chowk_neighbourhood` | Neighbourhood survey, yearly |
| price `price_neighbourhood_inr` | ₹4,999, yearly, INR |
| payment link | field kit, no customer portal needed |
| portal | enabled for the yearly tier only |

Nothing is created here: the workspace has no Stripe key and the skill's rule
is that the user signs in and pays for their own accounts.
