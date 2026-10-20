# Launch plan

One rule above all: no fake proof. No invented testimonials, no user counts,
no star ratings, no press logos. This survey has no users yet, and the page
says so by not claiming any.

## Before launch

| week | what | owner |
| --- | --- | --- |
| 1 | run the name checks in `brand.md` (trademark, domain, handles), buy the domain | user |
| 1 | register a Stripe account and create the two products in `pricing.md` | user |
| 2 | analytics that respect people: a self hosted counter, no cookies, no third party script in the page | build |
| 2 | error tracking on the app only, no session recording | build |
| 2 | privacy page and a plain data statement: nothing leaves the browser | build |
| 3 | import from a JSON export, and a short guide for moving a list across | build |
| 3 | a beta list of 30 people who already walk central Bengaluru | user |
| 4 | beta with real walks, collect notes in the app rather than in a form | user |
| 5 | fix what the beta finds, then publish | build |

The beta is the only place feedback comes from. Do not seed reviews, do not
ask friends to rate anything.

## Where the unhappy users already are

From the research in `replica/entrepreneur/reviews.csv`: 22 threads on Reddit,
mostly r/GoogleMaps, about routes, saved lists and ads. Those threads are the
place to answer questions as a person, with the project link in the profile
and not spammed into every thread.

Also: local walking and cycling groups in Bengaluru, accessibility groups,
and the OpenStreetMap India community, which has an interest in the data being
used well.

Do not post into a thread to argue. Post when there is something useful to
say, and say it as a person who built a thing, not as marketing.

## Launch day

1. **Show the noise number working.** A short screen recording of two routes
   for the same trip, one quiet and one loud, is the whole pitch.
2. **A post that leads with the fix, not the clone.** Title: "I made a map of
   central Bengaluru that tells you how loud the street is". Body: what it
   does, what it does not do (no traffic, no reviews, one part of one city),
   how it is built (OpenStreetMap plus a survey), and a link.
3. **Hacker News**, Show HN, same content, no growth language. Answer every
   question honestly, including the "why not just use X" one.
4. **Product Hunt** only if there is a real artefact to show. The field card
   is that artefact.
5. **Nothing paid.** No ads for a map that advertises its lack of ads.

## The first ten users

Talk to ten people by hand, in person or on a call, and watch them use it.
Not a survey. Ten sessions, notes in the app, and a fix list at the end of
each week.

Ask each one: what did you open the map for, did you find it, and did the
noise number change what you picked. If the third answer is no for most
people, the angle is wrong and should be revisited before spending more.

## What success looks like in month one

- 100 people who opened it more than once
- 20 saved places created by someone other than the author
- 5 fixes reported by someone other than the author
- 3 field cards downloaded
- not a single support email about a lost list, because there is no account
  to lose

## What would make this fail

- The dataset is one small part of one city. People outside it will bounce
  immediately, so the page must say the extent above the fold, not in the FAQ.
- The noise number is an estimate. If it is presented as measured, the first
  person who lives on a quiet-looking loud road will stop trusting all of it.
- No live traffic. Someone will ask for it in the first ten comments. The
  answer is in the FAQ already: it needs data this project will not take.
