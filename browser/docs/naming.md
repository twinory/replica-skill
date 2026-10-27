# Naming: the honest pass

The working name was **Veil**. It does not survive contact with the stores. This
page has the evidence, the decision, and the two tools that make the next rename
a one line job instead of an afternoon of grep.

This is evidence, not legal advice. A trademark search and a lawyer are the last
word, and nothing here replaces either.

## Verdict

| candidate | what is already there | verdict |
| --- | --- | --- |
| **Veil** | Play Store: `Veil Browser: Fast & Private` (package `com.veil.browser`), and `Veil - Fast Private Browser` (`com.dg.privatebrowse`). App Store: CloudVeil Browser, Veil Encrypted Messenger. Also `veilbrowser.cc`, an anti-detect browser sold at 1.99 a month, and an open source iOS VeilBrowser on GitHub. Plus Veilo, two browsers on Play. | **blocked**. A browser with this exact name ships today, so search results, reviews and support threads are already someone else's. |
| **Tacet** | App Store: Tacet Offline Document AI, Tacet haptic metronome, Tacet pushup app blocker, Tacet reading tracker. `tacet.app`, `usetacet.com`, a funded company on Tracxn. | **crowded**. Six apps share it. A name you cannot be found under is a name that costs you installs. |
| **Sotto** | App Store: `Sotto: Ad Blocker & Privacy`, 197,000 rules for Safari, same category. `sottocall.com`, Kitze's Sotto, two GitHub projects. | **blocked**. A direct competitor in the same category is the worst possible collision. |
| **Husk** | App Store: one HUSK Nutrition app. No browser found on either store. `husk.app` is registered (2018, Porkbun, expires 2027). | **usable, with work**. Short, one syllable, spellable, and the meaning fits: the browser chrome is the husk you shed, the site is the kernel you keep. |
| **Larch** | 21 App Store results, none a browser. No domain checked. | **usable**. Cleaner space, weaker story. Keep as the fallback. |

Decision: **Husk**. Bundle id `app.husk.browser`. Domain to buy: `huskbrowser.com`
or `gethusk.com`, since `husk.app` is taken.

The tagline it can carry: *the web, out of its shell*.

## Why short common words are a trap, and what to do about it

Every word I tried first was a real word, and real words are crowded because
everyone reaches for them. The check that matters is not "does the word exist"
but "does an app in the same category already use it as its own name".

So the rule for the next rename, in order:

1. Run the checker and read the exact matches, not the total:
   `python3 tools/name_check.py husk --domains huskbrowser.com,gethusk.com`
2. If an app uses the name as its own name in Utilities, Productivity or
   Reference, drop the candidate. That is the Sotto case.
3. If twenty apps merely contain the word, it is a search problem, not a legal
   one. Decide whether you can live with being unfindable.
4. Check the domain. A registered domain is not a blocker, but the name you
   cannot get a domain for is a name you will not market well.
5. Then, by hand, and before you spend money: USPTO TESS in class 9 and 42,
   EUIPO, the India IP office, the Play Store search box, and the handles on
   GitHub and X.

## The two tools

### Check a name before committing to it

```bash
python3 tools/name_check.py husk --domains husk.app,gethusk.com,huskbrowser.com
python3 tools/name_check.py husk --json > name-check.json
```

It queries Apple's public search API and RDAP, prints the apps that use the name
exactly, the apps that merely match it, and the registration date of every
domain you give it. Exit code 1 means crowded.

What it cannot do, and says so in its own output: the Play Store has no public
search API, and trademarks are not in any free API. Those stay manual.

### Do the rename, and prove it

```bash
python3 tools/rename.py --from Veil --to Husk --dry-run   # what would change
python3 tools/rename.py --from Veil --to Husk             # do it
python3 tools/rename.py --check --from Veil               # exit 1 if anything remains
```

It rewrites the display name, the Dart package and every `package:` import, the
env flag, storage keys, CSS class names, the Worker name, and every doc. Two
edge cases are handled, and both bit during this pass:

- An underscore is a word character, so a naive `\bVeil\b` misses
  `VEIL_UPDATE_BASE` and `veil-app`. The tool requires a non letter on each
  side instead.
- A CamelCase identifier glued to another word (`VeilApp`, `__veilBooted`) also
  slips past word boundaries. Those are listed in the sweep output and renamed
  by hand; the tool flags them on a second `--check` run.

The tool refuses to touch ordinary words that contain the name inside letters,
so `surveillance` and `unveiled` survive a rename to Veil or from it.

## What this pass did not do

- No trademark register search. `HUSK` is used by a nutrition app, a restaurant
  group and a bedding brand; none of them are browsers, but class 9 and 42 are
  where this gets decided.
- No Play Store check done by script. Search `husk` there by hand before
  submission.
- No domain purchase. `husk.app` is registered until 2027. If `huskbrowser.com`
  and `gethusk.com` are also gone, the name still works as a store name; a
  domain is nice, not mandatory, for a phone app.

If any of those comes back dirty, run `name_check.py` on Larch and then
`rename.py` once. That is now an afternoon, not a rewrite.
