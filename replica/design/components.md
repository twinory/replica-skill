# Components: Chowk

Every block is implemented in `app/css/app.css` and marked up in
`app/js/panel.js`. Sizes are CSS pixels at the default panel width of 396.
States listed are the ones the code actually renders; focus is always
`:focus-visible` with a 2px accent ring at 2px offset.

## Brand mark

```
BrandMark
  anatomy   rounded square 30px, forest fill, white pin glyph, name in Fraunces
            next to it, area in 11px uppercase tracked Inter under it
  states    hover lifts the mark 1px, active returns
  a11y      one button, label "Chowk, back to explore"
  used on   S01 to S12 (masthead)
```

## Search

```
SearchField
  variants  default, with query (clear button replaces the slash hint)
  sizes     one size, 44px tall, radius 11, surface fill, 1px border
  states    default, hover (border strong), focus (2px accent ring, no border),
            filled, disabled (not used), loading (skeleton list under)
  tokens    bg surface, border border, radius md, font md
  a11y      input type=search, aria-label, aria-expanded on results,
            aria-controls, Down arrow moves into the list, Esc clears
  used on   S02, S03
```

```
Kbd
  anatomy   18px high, mono 10.5px, 1px border, radius xs, text-muted
  used on   the slash hint in search, the Esc hint in the palette
```

```
Chip
  variants  category (dot in category colour plus label), action (icon plus
            count, e.g. Fixes), filter (pressed state only)
  sizes     30px tall, 12px side padding, pill
  states    default surface, hover surface-2, pressed accent-soft with accent
            text and 1px accent border, focus ring
  a11y      real button with aria-pressed, the dot is decorative
  used on   S02, S03, S05
```

## Lists

```
ResultRow
  anatomy   category icon in a soft tinted square 36px, name 14px/600,
            meta line 12.5px muted (kind, open state, distance), chevron
  variants  place, road (road icon, class as kind), station (metro line
            colour), saved item (bookmark icon, optional note on a second line)
  states    default, hover surface-2, selected accent-soft, focus ring
  a11y      a button covering the row, aria-label "Open <name>"
  used on   S03, S07, palette
```

```
Badge
  variants  open (success soft), closed (marigold soft), warn, calm, busy,
            quiet, neutral count
  sizes     18px tall, 10.5px/600, radius pill
  contrast  body pairs checked; marigold on marigold-soft is 4.88:1
  used on   S03, S04, S05
```

```
Tile
  variants  category count tile in the explore grid, 2 or 3 columns
  states    default, hover (lift and shadow), focus
  a11y      button, label reads "<Category>, <n> nearby"
  used on   S01, S02 empty
```

## Panel

```
PlaceHeader
  anatomy   cover band 92px in the category tint with a faint grid, category
            label top left and glyph top right, then name in Fraunces 34,
            kind line, open and busy badges
  states    open, closed, no hours (badge omitted, line says "Hours unknown")
  used on   S04
```

```
ActionRow
  variants  four actions: Directions (filled), Save (outline), Card (outline),
            Share (outline)
  sizes     equal columns, 62px tall, icon over 11px label
  states    default, hover, pressed (Save when saved: marigold icon and rail,
            label becomes Saved)
  a11y      each is a button with aria-pressed where it has two states
  used on   S04
```

```
FactList
  anatomy   rows of icon, label in 11px tracked caps, value in 14px, hairline
            between rows
  used on   S04: address, hours (full week table with today emphasised),
            access, contact, survey
```

```
HoursTable
  anatomy   seven rows, day 12px muted, time 13px, today in 600 weight and ink
  states    closed today (row says Closed), 24 hours (says Open all day)
  a11y      a real table would be better; currently definition rows with the
            day in a dt, read in order
```

```
NoteBox
  anatomy   label, textarea 3 rows, hint under it plus "saved" tick on write
  states    empty, focused, at limit (220 characters counted)
  a11y      label for=, maxlength, announces saved state with aria-live
  used on   S04, S07
```

## Directions

```
ModeTabs
  anatomy   segmented control, four segments, icon only, 42px tall
  states    selected (surface, shadow, ink icon), hover, focus
  a11y      role=tablist with aria-selected, arrow keys move between modes
  used on   S05
```

```
RouteField
  anatomy   origin and destination rows with a dot and an arrow, swap button
            between them
  states    empty (placeholder "Choose a start"), filled, focused
  used on   S05
```

```
RouteCard
  variants  fastest, quieter, step free, metro
  anatomy   mode icon, name, distance and road summary on the left, duration
            in Fraunces 22 on the right, hairline, selected card gets accent
            rail on the left and a tinted background
  states    default, selected, unavailable
  used on   S05, S06
```

```
NoiseCompare
  anatomy   eyebrow, two rows (this route, quietest option), gradient bar
            green to marigold with a tick at each value, delta line
  states    shown for walk, cycle and drive; hidden for transit and for a
            zero length route
  a11y      values are in the text, the bar is aria-hidden
  used on   S05
```

```
StepList
  anatomy   numbered or iconed steps, street name in ink, distance and action
            in muted, transit legs get line colour and stop count
  states    current (bold, accent dot), past (muted), upcoming
  used on   S05
```

## Map

```
ZoomCluster
  anatomy   vertical stack of 44px buttons, plus, minus, fit, locate, in one
            rounded card with hairlines
  states    default, hover surface-2, active pressed, disabled at max zoom
  a11y      buttons with labels and title shortcuts
  used on   S01
```

```
ScaleBar
  anatomy   1.5px rule with end ticks, label above it
  behaviour recomputes a round number (1, 2, 5 times a power of ten) from the
            projection at the current latitude
  used on   S01
```

```
LayerButton and LayerPopover
  anatomy   one stacked-squares button bottom left, popover 260px with rows
            of icon, name, checkbox
  states    button active when any layer is on, row on and off
  a11y      aria-expanded, rows are checkboxes, Esc closes
  used on   S08
```

```
ContextMenu
  anatomy   240px card at the pointer, clamped to the viewport
  items     What is here, Directions from here, Directions to here, Measure
            from here, Copy coordinates, Report a problem, Add a fix here
  states    open, keyboard navigable with Up and Down, Esc closes
  used on   S10
```

## Overlays

```
Modal
  sizes     narrow 380, panel 460, wide 640
  states    open with a 120ms scale and fade, closing, focus trapped, Esc closes
  a11y      role=dialog aria-modal, focus moves in, returns to the trigger
  used on   every modal and the field card
```

```
Palette
  anatomy   input row with a search icon and Esc hint, one list mixing places
            and commands, foot with three hints
  states    empty query shows commands, no results shows a suggestion to add
            the word to a fix
  a11y      role=combobox pattern, Up and Down move, Enter runs
```

```
Toast
  anatomy   bottom centre, 13px, surface, shadow 2, icon
  states    enters 160ms up, leaves after 2.6s, stacks never (new replaces old)
  a11y      role=status aria-live=polite
```

```
Skeleton
  anatomy   three lines with widths 42, 78, 60 percent, shimmer 1.2s
  used on   the first render before data lands
```

## Field card

```
FieldCard (canvas, 760 by 760 at 2x)
  anatomy   paper ground, 16px grid, header row with CHOWK FIELD CARD and the
            date, category chip, title in Fraunces 42 wrapped to two lines,
            190px neighbourhood plan with parks and a place dot, four facts in
            a 2x2 grid, calm bar, note (up to two lines, ellipsis), surveyed
            stamp rotated 6 degrees, OSM attribution
  accents   forest, marigold, ink, rose; each is a ground, ink and rule triple
  states    with a note, without one (falls back to the guide note)
  export    PNG at 1520 by 1520, file named chowk-<slug>.png
```

## What the recon saw but the clone does not ship

Star ratings, review cards, photo strips, popular times charts, street view
controls, the pegman, the traffic legend and the satellite toggle. Each is
recorded in `features.csv` as a skip with a reason, so parity stays honest.
