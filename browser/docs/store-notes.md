# Shipping it, and what the stores will say

This is the part that kills most ad-blocking browsers, and it is not a code
problem. Read it before you spend money on a domain.

## The name

The working name was Veil, and it is taken: a browser with that name ships on the
Play Store today under `com.veil.browser`, and CloudVeil is on the App Store.
`docs/naming.md` has the full evidence table and the reasoning.

The app is now **Husk**, bundle id `app.husk.browser`. What that pass established
and what it did not:

- Established: no browser named Husk was found on either store. The only App
  Store hit is HUSK Nutrition. `husk.app` is registered by someone else and
  expires in 2027, so plan on `huskbrowser.com` or `gethusk.com`.
- Not established: a trademark search. HUSK is used by a nutrition app, a
  restaurant group and a bedding brand. None are browsers, but classes 9 and 42
  are where this is decided. Run USPTO TESS, EUIPO and the India IP office
  before spending on a launch.

Before publishing:

1. Search the Play Store for the name by hand. There is no public API for it.
2. Run `python3 tools/name_check.py husk --domains yourdomain.com` again closer
   to launch. Store names churn monthly.
3. Do not put another company's name in the app name, subtitle, keywords, or
   screenshots. "Ad-free YouTube" as a listing is a trademark problem and a
   review rejection in one line.
4. If any check comes back dirty, run `name_check.py` on Larch, then
   `python3 tools/rename.py --from Husk --to Larch`. That is now one command.

## Apple App Store

Two guidelines matter here.

**4.2 Minimum functionality.** Apple rejects apps that are "simply a
repackaged website" or a thin wrapper. A browser has a better case than most,
because a browser is the product, but you still have to look like one: tabs,
history, a real address bar, per-site settings, App view, a limits page. This
repo's shell exists partly for that reason. Do not ship a single-site wrapper.

**5.2 Intellectual property.** "The app should work with YouTube" is fine.
"Ad-free YouTube" as the pitch invites a complaint from Google and a rejection
from Apple. Keep the marketing about the browser, and let the browser be good at
the sites people already use.

**4.7 / 5.4** cover content and web access. A general purpose browser is
allowed; an app whose only purpose is to strip a specific service's revenue is
not going to survive review, and will not survive a legal letter either.

Practical route: TestFlight first (up to 10,000 external testers, 90 day builds),
then a store submission with the browser framing. Expect one rejection and one
appeal. Have the limits page in the build; reviewers click Settings.

## Google Play

Play is friendlier to browsers and to ad blocking, with two conditions.

**Sensitive permissions.** A browser that wants `QUERY_ALL_PACKAGES` or
accessibility services to block in other apps gets extra scrutiny. This build
asks for neither: blocking happens inside the web view only. Keep it that way
unless you have a very good reason and a declaration ready.

**Ads policy.** If you ever put ads in the app itself, the app is an ad-supported
product that blocks ads, which is a contradiction reviewers notice. Keep it free
or paid, not ad supported.

**Data safety.** Declare no data collected. The app has no analytics, no crash
reporting, and no account. That is both true here and a selling point.

## Distribution without the stores

This is the fastest path to your own phone and to a few testers:

- **Android**: build the APK, upload it to the Worker as a static asset or to R2,
  point `ANDROID_BUILD_URL` at it. Installation needs "install unknown apps"
  permission on the phone. That is a normal, documented path.
- **iOS**: there is no equivalent. Ad Hoc installs work only on devices whose
  UDIDs are registered in your developer account; Enterprise needs a D-U-N-S and
  a company, and using it for a public app gets the certificate revoked.
  TestFlight is the honest answer.

## What to say in the listing

Lead with the browser and the transition, not with a site name:

- "A quiet browser that strips ads and trackers before the page loads."
- "Turn any site into a full screen app with one tap."
- "No account. No telemetry. Your filters, your list."

And keep the limits page public, the same words as in the app. The first review
that says "it didn't block YouTube pre-rolls" is survivable when the app already
told them it cannot.

## Checklist before a public build

- [ ] Name cleared for trademark, domain and store
- [ ] `python3 tools/check_assets.py` passes
- [ ] `flutter analyze` has no errors
- [ ] Limits page reachable from Settings
- [ ] No third party analytics or crash SDK linked
- [ ] Filter and patch files served from your own Worker, not a hard coded host
- [ ] Privacy policy page live (the Worker can serve it)
- [ ] Tested on a real iPhone and a real Android phone, not just simulators
- [ ] Tested the two flows that break most: Google sign-in, and a DRM site
