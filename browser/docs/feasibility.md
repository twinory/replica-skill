# Can this be a Brave?

Short answer: you can get most of the way there, one decision decides how far,
and no decision gets you all the way. This page is the reasoning behind what
`browser/` actually contains, so the trade-offs are visible before you spend a
month on the wrong one.

## The one decision: whose engine

A browser is two things: a shell (tabs, address bar, history) and an engine
(HTML, CSS, JavaScript, media). The shell is a few weeks of work. The engine is
decades. That is why Brave, Chrome and Firefox are separate companies and why
every "build a browser" plan fails at exactly this point.

| route | what you get | what it costs | honest verdict |
| --- | --- | --- | --- |
| Widget around the phone's engine (this repo) | Real browsing, real logins, real video. Native content blockers on both platforms. | Whatever the engine allows. On iOS that is WKWebView, which Apple keeps a version behind Safari on purpose. | Ships. Ceiling is "very good", not "Brave". |
| Chromium fork on Android, WKWebView on iOS | Brave's actual model. Full request control, extensions, per-site patches. | An engine team, a Chromium update cadence, gigabytes of tooling, a build farm. | Multi-year, not a skill. |
| Pure native app per platform, no engine | Best performance, best store story. | It is no longer a browser. | Only if you drop "load any site". |

**"Equally efficient on iPhone and Android" is achievable, but not by shipping
the same engine.** It is achieved by shipping the same shell around each
platform's own engine. Both get hardware accelerated rendering, both get
JIT-free but native JavaScript, both get the same filter lists and the same App
view rules. What differs is the engine underneath, and nobody can change that on
iOS: every browser on iPhone is WebKit, including the ones with their own name
on the App Store.

The visible difference between iOS and Android in this design:

| thing | iPhone | Android |
| --- | --- | --- |
| Ads blocked before load | Yes, compiled into a WKContentRuleList | Yes, via content blockers plus optional request interception |
| Element hiding | Yes, injected CSS | Yes, injected CSS |
| Ads inside a video stream | No | No |
| User scripts | Yes, WKUserScript | Yes, injected at document start |
| DRM protected audio and video | Depends on the DRM. FairPlay streams play in a WKWebView. Widevine never does. | Usually yes, on certified devices |
| Google sign-in in the page | No. Google blocks web views. | No. Same block. |
| Background audio | Needs an audio session set natively | Works once the media does not require a gesture |

## The user requests, checked one by one

**"Runs ad-free, no matter what."** Not a promise any browser can keep. There
are three kinds of ad, and only two are blockable:

1. Separate request (an ad network script or image). Blockable, and the request
   never happens. This is the majority of the web.
2. Stitched into the media stream (server side ad insertion). Not blockable at
   the browser layer, because the ad is inside the same file as the show. This
   is most of YouTube pre-roll, Twitch, and live sport.
3. Baked into the content (a sponsor read in a podcast, a promoted post served
   by the same endpoint as normal posts). Not blockable without breaking the
   content.

The app ships with a list covering 1, a player patch that fast-forwards and skips
2 where the page still exposes the skip control, and a visible page in Settings
that says what it does not cover. That last part matters: the first time a
pre-roll plays, the user blames the app unless it already said so.

**"YouTube, Spotify, YouTube Music run clean."**

- YouTube and YouTube Music: mobile web with network and element rules, plus a
  guarded player patch. Usable, ads mostly gone, and honest about the ones that
  are not. Sign-in works by routing Google's login page to the system browser.
- Spotify: the UI works everywhere. Playback needs Widevine, and no iOS browser
  or web view can decrypt Widevine, Safari included. So on iPhone the app offers
  the real Spotify instead of a spinner. That one is a platform wall.
- JioHotstar: worth being precise, because an earlier version of this page got it
  wrong. JioHotstar serves a Safari player, and Safari on iOS means FairPlay.
  FairPlay is available to a WKWebView too, so the stream is not the blocker. The
  blocker is the browser check: a web view that introduces itself as an embedded
  browser gets a "use the app" page before any video exists. The app now sends
  the user agent Safari sends, and turns on desktop mode for this site, and only
  offers the real app after the player has actually failed. Brave on the same
  phone works for the same reason: it is WebKit with a Safari user agent.

The general rule, and the one to apply to the next site: **FairPlay can play in
an app's web view, Widevine cannot.** Whether a given service plays then comes
down to the user agent it sniffs and the policy it applies, which is why the app
ships a desktop switch and a playback probe instead of a list of verdicts.

**"Same efficiency on both platforms."** Same shell, same lists, same
transitions, each engine native to its platform. Measured in feel: scrolling,
video and page loads are as fast as the phone's own browser, because it is the
phone's own engine.

**"Turn the page into a real app view."** This is the part that is genuinely
buildable, and it is where the product can beat Brave:

- Browser chrome (address bar, progress, tab count) disappears, the status bar
  stays, and the page reflows into the freed space without a reload.
- Per site CSS, loaded from a file the Worker updates, hides the web-only
  furniture: app install banners, "open in app" bars, cookie walls that
  duplicate in-app prompts.
- Safe areas are respected, inline video is allowed, and the back gesture goes
  back inside the site before it leaves it.
- The choice is remembered per site, so the second visit is a real app launch.

**"No interferences."** Popups are refused at the web view level rather than
covered up. Downloads are handed to the operating system. Google's login opens
where Google insists it open. Everything else stays in the tab.

## What building it actually takes

| piece | state in this repo | left to do |
| --- | --- | --- |
| Flutter shell, tabs, history, settings | Done | Polish, accessibility pass, tablet layout |
| Filter engine and lists | Done, 311 network rules and 129 element rules | Grow the list, add a fork upstream, keep it current |
| App view and per site patches | Done for 12 sites | Add the sites your users actually open |
| Update server | Done, Cloudflare Worker | Deploy, point the app at it, add a domain |
| Android and iOS scaffolds | Scripted | Run `tools/scaffold.sh`, then `flutter run` |
| Store launch | Not started | Naming, trademark, listing, review risk. See `store-notes.md` |

Realistic estimate for one experienced Flutter developer to a build you would
use daily: two weeks. To something you would put on the Play Store: six to eight
weeks, most of it in the review risk and the filter maintenance, not the code.
