# WEBSITE_MOBILE_AUDIT — the app against sxccaa's mobile view

**Permanent requirement.** The SXCCAA app's UI is a 1:1 reproduction of the
existing website's mobile view. Not similar, not inspired by, not improved.
Where this document and a design instinct disagree, this document wins.

---

## 0. How every number here was obtained

The website was run locally (`npm --prefix oxvercity run dev`, port 3300), the
viewport set to **390 × 844**, and each value read off the live DOM with
`getBoundingClientRect()` and `getComputedStyle()`. Nothing is recalled,
estimated or rounded to a scale. Where a number looks odd — 23.111px line
height, a 34.32px hero, a 196.9px image — it is odd on the website too.

### Three traps that invalidate a naive measurement

1. **The Framer export renders every block three times** — desktop, tablet,
   phone — and hides two with CSS. `document.querySelector('header')` returns a
   *hidden* variant. Every probe below walks the ancestor chain and discards
   anything whose `display`, `visibility` or `opacity` hides it.

2. **Scroll reveals start at `opacity: 0; transform: translateY(30–80px)`.**
   Measuring without clearing them returns either nothing or a position 30–80px
   too low. The previous audit recorded the About heading at `y = 934`; its
   resting position is **904**, and the 30px difference was an unfired reveal.
   Every measurement here clears reveals first:

   ```js
   document.querySelectorAll('[style]').forEach((e) => {
     const s = e.getAttribute('style') || '';
     if (s.includes('will-change:transform') && s.includes('opacity:0')) {
       if (e.closest('[aria-hidden="true"]')) return;   // leave hidden variants alone
       e.style.opacity = '1'; e.style.transform = 'none';
     }
   });
   ```

3. **`requestAnimationFrame` does not run in this environment** (the browser
   pane is headless; see the `browser-pane-is-hidden` note). So scroll-driven
   components — the About slider, the Voices field, the chapters marquee — sit
   frozen at whatever state their first paint left. Their *rest* geometry has to
   be derived from CSS (`left`, `width`, the declared transform) rather than
   read after scrolling. Section 3.2 below does exactly that and says so.

---

## 1. Routes

| Website route | Website mobile height | App route | App file |
|---|---|---|---|
| `/` | 8185 | `/` | `app/index.tsx` |
| `/about` | 7904 | `/about` | `app/about.tsx` → `components/pages/AboutPage.tsx` |
| `/chapters` | 4768 | `/chapters` | `components/pages/ChaptersPage.tsx` |
| `/events` | 13464 | `/events` | `components/pages/EventsPage.tsx` |
| `/explore` | — | `/explore` | `components/pages/ExplorePage.tsx` |
| `/alumni` | — | `/alumni` | `components/pages/AlumniPage.tsx` |
| `/contact` | — | `/contact` | `components/pages/ContactPage.tsx` |
| `/privacy-policy`, `/terms-of-use` | — | same | `components/pages/PolicyPage.tsx` |
| `/login`, `/me` | — | same | `app/login.tsx`, `app/me.tsx` |

Navigation is **correct in kind**: the app has no bottom tab bar, and the
website has none either. The earlier five-tab bar was already removed.

---

## 2. The global shell

### 2.1 Header — identical on every page

| Property | Website (measured) | App as built | Difference | Correction |
|---|---|---|---|---|
| Box | fixed, 390 × **72**, `z-index: 10`, background transparent | absolute, 72, transparent | — | none |
| Crest | `/svg/logo-crest.svg`, **37 × 44.2** at (20, 13.9) | 37 × 44 at gutter, vertically centred | ≤0.2px | none |
| Login pill | x **221.4**, y 20.3, **78.6 × 31.5**, radius 30, `1px solid` tint, padding `8px 20px` | padding 8/20, radius 30 | **height 36, not 31.5** | `loginPill` line-height 18 → **13.5** |
| Pill label | Inter **500**, 13.5px, **line-height 13.5** | Inter 500 13.5 / **18** | 4.5px taller | as above |
| Hamburger target | **48 × 48 at x = 322** (right edge 370) | 48 × 48, right-aligned | target matches | none |
| Hamburger glyph | **24 × 18 at x = 334** — centred in the target | `alignItems: 'flex-end'` → glyph at x = 346 | **12px too far right** | centre the glyph in its target |
| Glyph bars | three, 24 × 2, at y 27 / 35 / 43, **square corners** | 24 × 2, `borderRadius: 1` | rounded | `borderRadius: 0` |
| Gap pill → target | 22 (300 → 322) | `gap: 8` | 14px short | set the gap to 22 |
| Search icon | **none at 390px** | none | — | none |

### 2.2 Mobile menu — hamburger dropdown

| Property | Website (measured) | App as built | Difference | Correction |
|---|---|---|---|---|
| Panel | **350 × 464 at (20, 90)**, white, radius **12**, padding **20**, row gap **16** | 350 wide at (20, 90+inset), radius 12, padding 20 | — | none |
| Backdrop | **none** — the panel is the whole overlay | `rgba(17,17,17,0.35)` scrim + `shadowOpacity 0.18` + `elevation 12` | **invented** | delete the scrim and the shadow |
| Rows | 10 links, each **28** tall, pitch **44** | `minHeight: 44` rows | pitch matches; row box differs | set row height 28, gap 16 |
| Link type | Inter **600**, 16 / **17.6**, `rgb(17,17,17)` | preset `navLink` — same | — | none |
| Order (by measured y) | Home · About SXCCAA · Alumni Directory · **Explore the Network** · **Xaverians Making a Difference** · Chapters · Alumni Events & Activities · Contact · Privacy Policy · Terms of Use | from `content.nav.mobile` | items 4 and 5 are **transposed** in the bundle | swap them |

### 2.3 Footer — 721px, on every page

| # | Block | Website (measured) | App as built |
|---|---|---|---|
| 1 | Wordmark | `/svg/logo-dark.svg` **129 × 32** at (20, top + 59.6) | **missing** |
| 2 | "Association Office" | Instrument Sans **15 / 600 / 20.625**, ink, +14 | preset `label` ✓ |
| 3 | Address | Roboto **15 / 400 / 20.625**, **ink**, w 335.1, 2 lines, +7.1 | `ink70`, +8 |
| 4 | "Email" | same as 2, +15.6 | +24 |
| 5 | `contact@sxccal.edu` | Roboto 15/400/20.625 ink, +7 | `ink70`, +8 |
| 6 | Column heads | **two-column grid**, x = 20 and **x = 207**, col width 163; Instrument **18 / 700 / 23.4**; +31.7 | **single column, stacked**, +32 |
| 7 | Column links | Instrument Sans **15 / 600 / 20.625** ink, pitch **26.6** | Roboto `small`, `ink70`, `minHeight: 36` |
| 8 | Columns, row 1 | **Main Pages** (Home, About SXCCAA, Alumni, Chapters, Events & Activities, Stories) ‖ **Explore** (Alumni Directory, Connect) | one after another vertically |
| 9 | Columns, row 2 | **Support** (Contact SXCCAA) ‖ **Utility Pages** (Search, Privacy Policy, Terms of Use), +20 | — |
| 10 | Watermark | `/svg/logo-watermark.svg` **370 × 67.5 at x = 10**, +30 | **missing** |
| 11 | Copyright line | **does not exist** | `© {associationName}` above a 1px rule — **invented** |
| 12 | Top border | **none** | `borderTopWidth: 1` — **invented** |

**Corrections:** add the wordmark and the watermark; make the link columns a
two-column grid at x = 20 / 207; change link type from Roboto `small`/ink70 to
Instrument Sans 15/600/ink at a 26.6 pitch; delete the copyright line and the
top border.

---

## 3. Home — `/` (8185)

| # | Section | y | Height | Background |
|---|---|---|---|---|
| 0 | Hero | 0 | **844** (full viewport) | `hero-bg.jpg` |
| 1 | About | 844 | 1225 | white |
| 2 | The Xaverian community | 2069 | 1174 | **#111111** |
| 3 | Explore the Xaverian network | 3242 | 1128 | white |
| 4 | Inside the Xaverian experience | 4371 | 856 | **#111111** |
| 5 | Voices From Our Community | 5227 | 2237 | **#111111**, scroll-pinned |
| — | Footer | 7464 | 721 | white |

Section order and backgrounds in the app are **correct**. Everything below is
about what is inside them.

### 3.0 Hero

| Property | Website | App | Correction |
|---|---|---|---|
| Padding | `120px 0 60px` | 120 / 60 ✓ | none |
| Photo | `hero-bg.jpg`, `cover`, **`50% 35%`** | same | none |
| Overlay | **two layers**: flat `rgba(19,62,109,0.15)`, then `rgba(17,17,17,0.08)` + `linear-gradient(to top, rgba(10,20,35,0.72) 0%, 0.44 30%, 0.14 60%, 0 80%)` | single flat `rgba(17,17,17,0.28)` | reproduce both layers |
| Title | Olde English **34.32 / 37.752**, white, centred, w 350, **top at y = 164.4** | same type, top at 120 | **+44.4** — push the title down |
| Subtitle | Olde English **21 / 24.36**, centred, y **209.8** (+16.5) | `marginTop: 16` | +0.5; set 16.5 |
| Buttons | **none at 390px** | none ✓ | none |

### 3.1 About (844 → 2069)

| Block | Website | App as built | Correction |
|---|---|---|---|
| `h2` "About" | 36/700 ink, **left**, y 904 = **top + 60** | `paddingTop: 90` | **60** |
| `h3` "SXCCAA" | 36/700, y 941.8, no gap | ✓ | none |
| Lede | Instrument **20/600/24** ink, w 350, **+32** | `marginTop: 42` | **32** |
| CTA 1 | `/alumni` "Explore Alumni" — **186.2 × 48.1**, **bg #111111**, radius **80**, padding `12.5px 20px`, label Inter 600 16/23.111 **white**; **+20** below the lede | outlined pill, ink text, radius 30, pad 8/20, `marginTop: 32` | filled, radius 80, pad 12.5/20, +20 |
| CTA 2 | `/events` "Events & Activities" — 213.2 × 48.1, **bg #f8f8f8**, ink label, radius 80; **+14** | outlined, `marginTop: 16` | grey fill, +14 |
| Composition | **scroll-driven sticky slider**, block 350 × **669** at y 1340, pin **350 × 129** sticky at `top: 239.84`, travel 540 | static absolutely-placed collage from `about.collage` | rebuild — see below |

**The About composition, at rest** (derived from CSS, because rAF is dead here):
three panels in a 350 × 129 frame, all `top: 0`, `height: 129`, radius 10 —

| Panel | x | Width | Fill | Image |
|---|---|---|---|---|
| Crest | **20** | 77 | `#111111` | `about-crest-512.png`, `contain`, inset 12% |
| Campus | **104.7** | 180.6 | — | `about-slide-1-1024.jpg`, `cover` |
| EMRC | **293** | 77 | `rgb(147,240,239)` | `about-emrc-512.png`, `contain`, inset 7% |

At the start of the travel the two side panels sit tucked against the centre
panel's edges at **opacity 0.4**, and slide out to the positions above as the
block scrolls, reaching full opacity over the last 28% of the travel.
The app's current collage is a snapshot of the *wrong* state — it was measured
mid-animation, which is why the crest overflows the right edge at x = 366.

### 3.2 The Xaverian community (2069 → 3243), dark

| Block | Website | App as built | Correction |
|---|---|---|---|
| `h2` ×2 | 36/700 white, **`text-align: center`**, y 2128.8 / 2166.6 = **top + 60** | left-aligned, `paddingTop: 90` | centre; 60 |
| Card image | **350 × 300**, x 20, first at **+30** below the heading | `marginTop: 39` | 30 |
| Overlay title | Instrument **28/500** white, x **40**, at **imageTop + 196.7** | 197 ✓ | none |
| Overlay body | Roboto **16/22.4**, `rgba(255,255,255,0.8)`, x 40, **w 310**, +6 below the title box | `marginTop: 7`, `numberOfLines={2}` | +6; drop the line clamp |
| Scrim | **none** — the crops are dark at the foot | `rgba(17,17,17,0.55)` 150px band | **delete** |
| Card gap | **24** (pitch 324) | `marginTop: 43` | 24 |
| Images | `about-slide-1.jpg`, `community-initiatives.jpg`, `community-events.jpg` | from the bundle ✓ | none |

### 3.3 Explore the Xaverian network (3242 → 4370) — **the largest error**

The website's block is an **accordion** (`ExploreAccordion`, `framer-49uvd`)
with exactly one item open. The app renders a **horizontal snapping carousel**.
The previous audit's "cards are 281 wide at x = 21 with overlapping y values —
a horizontal carousel" was a misreading: 281.1 is the *text column* width, and
the overlapping y values are collapsed items whose inner blocks are 1px tall.

| Block | Website (measured) | App as built | Correction |
|---|---|---|---|
| Heading | 36/700 ink, **centred**, y 3302.4 = top + 60; "Explore the Xaverian" **wraps to two lines** (h 75.6), then "network" | left-aligned, `paddingTop: 90` | centre; 60 |
| Control | **accordion**, one open | horizontal `ScrollView`, `snapToInterval: 301` | **replace with an accordion** |
| Item box | x 20, w 350, padding `0 2px 0 1px` | — | build |
| Rule | 1px `rgba(17,17,17,0.15)`, **w 347**, at the item's top edge | — | build |
| Inner padding | `24px 0` | — | build |
| Closed height | **82.2** | — | build |
| Open height | **462.2** | — | build |
| Title | Instrument **26/700** ink, x 21, w 281.1 | 26/700 ✓ | none |
| Icon | **30 × 30** circle at x **338**, radius 24. Closed: transparent, `1px` ink border, ink plus. Open: **`#111111`** fill, white plus **rotated 45°** | **missing** | build |
| Body (open) | Roboto 16/22.4 ink, **+12** below the title | `marginTop: 12` ✓ | none |
| "Explore" (open) | **128.2 × 48.1**, x 21, bg `#111111`, radius 80, pad `12.5/20`, white Inter 600 16 | plain text link, `marginTop: 27` | build the pill |
| Image (open) | **250 × 193.2**, radius 10, clipped by a wrap of the same height, **+24** below the button | 250 × 193, `marginTop: 37` | +24, radius 10 |
| First item | y 3461.8 = **+46** below the heading block | `marginTop: 81` | 46 |
| Section CTAs | **two pills at x = 20, both `#111111`**: "Explore the Network" → `/explore` (227.4 × 48.1, **+30** after the last item), "Events & Activities" → `/events` (213.2 × 48.1, **+14**) | **missing** | build |

### 3.4 Inside the Xaverian experience (4371 → 5227), dark

| Block | Website | App as built | Correction |
|---|---|---|---|
| `h2` ×2 | 36/700 white, **centred**, y 4430.8 = top + 60 | left, `paddingTop: 90` | centre; 60 |
| Card image | **350 × 196.9** (≈16:9), x 20, first at **+30** | `aspectRatio: 4/3`, `marginTop: 39` | 350 × 196.9; +30 |
| Title | Instrument **24/600** white, x 40, **overlaid at imageTop + 95.3** | rendered **below** the image, `marginTop: 20` | **overlay** |
| Body | Roboto 16/22.4 `rgba(255,255,255,0.8)`, x 40, w 310, **overlaid**, +8 below the title | below the image, `marginTop: 12` | **overlay** |
| Card gap | **24** (pitch 220.9) | `marginTop: 40` | 24 |

### 3.5 Voices From Our Community (5227 → 7464), dark

The website pins an 844-tall panel (`.sx-voices__pin`) for 2237px of scroll and
moves a 506-tall field of quotes through it. The app renders three static
bordered quote blocks with `rgba(255,255,255,0.15)` rules.

**Not yet measured block-by-block** — the field is scroll-driven and this
environment cannot run it. It needs a dedicated pass driving `scrollY` and
reading the field's transform from `voices.css`. Listed in §6 as open work.

---

## 4. The inner pages

Every page below is a **bespoke editorial layout** on the website. The app
currently renders each as the same generic stack — eyebrow label, `h2`, body
paragraph, image, repeat — built from the content bundle. That stack matches no
page on the site. These are structural rebuilds, not spacing tweaks.

### 4.1 `/about` (7904) — 6 sections

| # | Section | y | Height | Background | App as built |
|---|---|---|---|---|---|
| 0 | Banner | 0 | **844** | `/images/home/voices-bg.jpg`, full-bleed | no banner; a white `Band` with an eyebrow |
| 1 | About | 844 | 1258 | white | — |
| 2 | Pillars | 2102 | 844 | **#111111** | a dark band of stacked `h3` + body |
| 3 | History | 2946 | **1769** | white | a list of year + title + text |
| 4 | Why | 4715 | 1198 | **#f8f8f8** | absent |
| 5 | College | 5913 | 1269 | white | absent |

Measured details already captured:

- **Banner.** "About the" — Instrument **36/700/42.84** white, x 20, y **695.2**;
  "Association" — **60/700**, line-height **56**, y **795.8**, split into
  **per-character spans** for a letter-by-letter reveal, spanning x 20 → 360.
  The app has neither the photo, the two-size treatment, nor the split.
- **About.** `h2` "About" y 904, `h3` "SXCCAA" 941.8 (same as Home); lede
  Instrument 20/600 at **993.6** (**+14.2**, *not* Home's +32); one CTA
  "Discover the Association" at x 20, y ≈1185.6; then
  `story-quadrangle.jpg` **126 × 149** at x **132**, radius 10 — another
  scroll-driven composition.
- **Stat lines.** "1850", "8,590 +", "…th" — **Montserrat 36/600/41.625**,
  `text-align: center`, x 40; body Roboto **16/23.111** ink, w 310, ~97 below.
  **Montserrat is a fifth font** and is not loaded in the app. The third figure
  reads "0 th" in the probe because `NumberCounter` animates from 0 and rAF is
  dead; the real target must come from `src/data/pages/about.ts`.
- **Pillars.** Heading "Mission," / "vision" / "and legacy" 36/700 white, y
  2206.2 = **top + 104.2** (this section is `sx-section`, not the Framer
  section — its padding is *not* 60). An **accordion**: "Our mission" open
  (24/600 white title, body Roboto 16/**23.111** white, three bullet lines),
  "Our vision" and "Our legacy" collapsed at y 2736.2 and 2830.2.

### 4.2 `/chapters` (4768) — 6 sections, its own type scale

| # | Section | y | Height | Background |
|---|---|---|---|---|
| 0 | `cx-stage` | 0 | 844 | **`rgb(11,11,12)`** |
| 1 | `cx-meets` | 844 | 816 | white |
| 2 | `cx-billwrap` | 1660 | 923 | **`#f7f6f3`** |
| 3 | `cx-join` | 2583 | 792 | white |
| 4 | `cx-net` | 3375 | 505 | `rgb(11,11,12)` |
| 5 | `cx-close` | 3880 | 167 | `rgb(11,11,12)` |

This page does **not** use the Framer presets. Its own scale, measured:

- Eyebrow: Instrument Sans **11 / 600 / 13.2**, `rgba(17,17,17,0.62)` —
  e.g. "02 — The meets", "03 — On the bill"
- Heading: Instrument Sans **34 / 700 / 35.36**, ink
- Body: Instrument Sans **14.5 / 400 / 23.49**, `rgba(17,17,17,0.62)`
- Stage: `/images/brand/crest.png` **460 × 548** at x 39.2 (overflows the
  viewport), tinted `rgb(242,236,225)`; `nostalgia-23.jpg` **392 × 220.5**
- Bill: a **horizontal marquee** of names in Instrument Sans **30/700/34.5**
  with `color: transparent` (outlined text), repeated twice for the loop
- Dark colour is **`#0b0b0c`**, not `#111111` — not in `theme/colour`

The eyebrow-plus-rule motif the previous audit deleted from Home as "invented"
**is real here**, and the app's chapters screen should carry it.

`cx-net` is the SVG network map. `react-native-svg` is installed; the map is
not built.

### 4.3 `/events` (13464) — the longest page on the site

| # | Section | y | Height | Background |
|---|---|---|---|---|
| — | `EventsUpcoming` | 1387 | 807 | — |
| 0 | `ev-stage` | 0 | 1387 | **`rgb(20,12,39)`** |
| 1 | `ev-index` | 2194 | 1384 | transparent |
| 2 | `ev-story` | 3578 | **3038** | white |
| 3 | `ev-archive` | 6616 | **4177** | `#f7f6f3` |
| 4 | `ev-gallery` | 10793 | 1950 | transparent |

Source order is `EventsUpcoming · EventsHero · EventsIndex · EventsStory ·
EventsArchive · EventsGallery`. The app renders three generic bands totalling a
fraction of this, and has no index, no story, no archive and no gallery.
`rgb(20,12,39)` is a sixth colour absent from the app theme.

### 4.4 `/explore`, `/alumni`, `/contact`

| Route | Website sections (from source) | App as built |
|---|---|---|
| `/explore` | `ExploreBanner` · `ExploreList` — the same accordion as Home §3.3 | a vertical stack of image + title + body cards |
| `/alumni` | `AlumniHero` (with stats) · `AlumniFeatured` · `SignInPrompt` (unverified only) · `AlumniDiscover` | one band: title, lede, a Login pill, a privacy note |
| `/contact` | `ContactBanner` · `AccessRequestSection` (with Turnstile) · `ContactFaq` (accordion) · `LocationSection` | title, lede, office/email/socials, then a form |

None of these three has been measured block-by-block yet; each needs its own
pass before it is rebuilt. Listed in §6.

---

## 5. Design-system corrections

`mobile/theme/index.ts` is measured and mostly right. Three gaps:

| Item | Website | Theme | Action |
|---|---|---|---|
| `preset.loginPill` | line-height **13.5** | 18 | change |
| Button geometry | radius **80**, padding **12.5 × 20**, height 48.1 | `layout.pillRadius: 30` | add a `pill` spec; keep 30 for the Login pill, which really is 30 |
| Montserrat | `/about` stat figures, 36/600/41.625 | absent | add `@expo-google-fonts/montserrat/600SemiBold` (per-weight import — see the bundle-size note) |
| `#0b0b0c` | `/chapters` dark | absent | add `colour.chaptersInk` |
| `rgb(20,12,39)` | `/events` stage | absent | add `colour.eventsInk` |
| `rgb(147,240,239)` | About slider EMRC panel | absent | add |
| `#f8f8f8` | secondary button fill | `colour.grey` ✓ | none |

---

## 6. Order of correction

Phase 6's rule applies: no screen is started until the one before it has been
compared against the website at 390 × 844.

1. **Shell** — header pill height, glyph centring, menu scrim/shadow removal,
   menu order, footer rebuild (wordmark, two-column grid, watermark, delete the
   invented copyright rule)
2. **Home §3.0–3.2** — hero overlay and title offset; About spacing, filled
   CTAs, the sticky three-panel composition; community card spacing, centred
   headings, scrim removal
3. **Home §3.3** — replace the carousel with the accordion; add the two pills
4. **Home §3.4** — overlay the Inside cards; 350 × 196.9; 24px gaps
5. **Home §3.5** — measure and rebuild Voices
6. `/about` — measure sections 3–5 (History, Why, College), add Montserrat,
   rebuild all six
7. `/chapters` — its own type scale, the marquee, the SVG network map
8. `/events` — six blocks, measured
9. `/explore`, `/alumni`, `/contact`, policies
10. Re-audit every screen at 390 × 844 and again at 360 / 412 / 430

**Still to measure** (nothing below has been read off the DOM yet): Home's
Voices field; `/about` History, Why and College; `/chapters` meets, bill, join,
network, close; all of `/events`; all of `/explore`, `/alumni` and `/contact`.

---

## 6a. Status — shell and Home complete

Verified by running the app's web target at `http://localhost:8081` at 390 × 844
and re-running the §0 probe against it. Every landmark from the hero to the last
footer link is within **0.1px** of the website.

| Element | Website | App | Δ |
|---|---|---|---|
| Hero title | 164.4 | 164.4 | 0 |
| Hero subtitle | 209.8 | 209.7 | −0.1 |
| `h2` "About" | 904 | 904 | 0 |
| "The Xaverian" | 2128.8 | 2128.8 | 0 |
| Community card 1 title | 2431.1 | 2431.1 | 0 |
| "Explore the Xaverian" | 3302.4 | 3302.4 | 0 |
| Accordion item 1 title | 3486.8 | 3486.8 | 0 |
| Accordion "Explore" pill | 3647.1 | 3647.1 | 0 |
| "Inside the Xaverian" | 4430.8 | 4430.8 | 0 |
| Campus / Life at Xavier's / Academics | 4631.7 / 4852.5 / 5065.4 | 4631.6 / 4852.5 / 5065.3 | ≤0.1 |
| "Voices From Our Community" | 5336.7 | 5336.6 | −0.1 |
| Footer — Association Office | 7569.6 | 7569.5 | −0.1 |
| Footer — Main Pages … Terms of Use | 7728.8 … 8030.6 | same | ≤0.1 |

### Four findings worth keeping

1. **Scroll reveals sit 30px low.** Measuring without clearing them produced the
   90px section padding the first build used everywhere. The real value is 60.
2. **The website reorders content in CSS.** The mobile menu, and the three
   "Inside the Xaverian experience" cards, are rendered in a different order
   from the one the data declares. React Native has no `order`, so both are
   re-sorted explicitly in the app — keyed on `href` and image filename, never
   on array index.
3. **Reproduce measured *tops*, not gaps.** A web text node's box is its glyph
   height; React Native's is the line box. Three times now — the hero subtitle,
   the footer's Email label, the footer's first column row — copying the
   website's gap put the next block 2.5–8.8px low. The measured top is the
   target.
4. **`<Link asChild>` drops a margin set on its child.** The footer links
   rendered at a 20.6 pitch instead of 26.6 and the column came out 31px short.
   Use `gap` on the container.

### Two deliberate approximations

- The Voices cards use `expo-blur` for `backdrop-filter: blur(14px)
  saturate(1.1)`. `BlurView` cannot saturate, so the glass is marginally
  flatter than the web's.
- The "Inside the Xaverian experience" card gaps are **24 then 15.9**. The
  section is a fixed 856 tall and distributes its content, so the last gap is a
  leftover rather than a chosen value. A uniform 24 makes the section 8px tall.

## 6b. Earlier status — shell and Home §3.0–3.4 corrected

Verified by running the app's web target at `http://localhost:8081` at 390 × 844
and re-running the §0 probe against it. `Δ` is app minus website.

| Element | Website | App | Δ |
|---|---|---|---|
| Hero title top | 164.4 | 164.4 | **0** |
| Hero subtitle top | 209.8 | 209.7 | −0.1 |
| `h2` "About" | 904 | 904 | **0** |
| `h3` "SXCCAA" | 941.8 | 941.8 | **0** |
| Lede | 1011.6 | 1011.6 | **0** |
| "Explore Alumni" label | 1212.1 | 1212.1 | **0** |
| "Events & Activities" label | 1274.2 | 1274.2 | **0** |
| "The Xaverian" | 2128.8 | 1601.8 | **−527** |
| "Explore the Xaverian" | 3302.4 | 2775.4 | −527 |
| "Alumni Directory" (accordion item 1) | 3486.8 | 2959.8 | −527 |
| "Inside the Xaverian" | 4430.8 | 3897.8 | −533 |
| "Voices From Our" | 5286.8 | 4762 | −525 |

**Everything above the About composition is exact.** Everything below carries a
single constant offset with one cause: the About section's sticky slider block
is **669** tall on the website and 129 in the app, because only its rest frame is
drawn and none of its 540px of scroll travel. Closing that one gap closes every
row in the lower half of this table.

Applied: header pill height and hamburger centring; menu scrim, shadow and row
rhythm; menu order; the footer rebuild; the two-layer hero overlay; 60px section
padding throughout; centred headings on sections 2–5; filled radius-80 buttons;
the community-card scrim removed and its spacing corrected; **the Explore
carousel replaced with the accordion**; the Inside cards converted to overlays.

Not yet applied: the About slider's scroll behaviour and block height; the
Voices field; everything in §4.

## 7. App-only screens

Sign-in, the session sheet, Turnstile, event photo capture, the photo viewer and
notifications have no website counterpart. They use the website's presets,
colours and controls and introduce no new visual language. `theme.space` and
`theme.radius` exist for them alone — **website pages must not use them**,
because a shared spacing scale is how a reproduction quietly turns back into a
design system.
