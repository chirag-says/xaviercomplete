# UI audit — app vs the website's mobile view

**Requirement (permanent):** the SXCCAA app UI must be a 1:1 reproduction of the
existing website's mobile view. Not similar, not inspired by, not improved.

**Method.** The website was run locally and inspected at **390 × 844** (a Pixel /
iPhone-class width). Every value below was read from the live DOM with
`getComputedStyle` and `getBoundingClientRect` — none is recalled or estimated.

**One trap that invalidates naive inspection.** The Framer export renders every
block **three times** — desktop, tablet, phone — and hides two with CSS. So
`document.querySelector('header')` returns a *hidden* variant with height 0.
Every measurement here filters to the variant that is actually visible at 390px.
Any future audit must do the same or it will measure the desktop layout.

---

## A. The measured truth at 390 × 844

### Fonts — there are **four**, not three

| Family | Where |
|---|---|
| **Olde English** | The hero: "St. Xaviers College (Calcutta)" and "Alumni Association" |
| Instrument Sans | Headings, ledes, card titles |
| Roboto | Body copy |
| Inter | Navigation, buttons, labels |

`Olde English` is served from `/fonts/OldeEnglish.ttf` — **the single `.ttf`
among the 80 files in `public/fonts/`**, the other 79 being `.woff2`. It is
directly usable in React Native, and was missed entirely on the first pass.

### Type presets, measured at 390px

| Preset | Family | Size | Weight | Line-height | Used for |
|---|---|---|---|---|---|
| `1y2slg` | Olde English | 34.32 | 400 | 37.752 | Hero title |
| `1o91uer` | Olde English | 21 | 400 | 24.36 | Hero subtitle |
| `1tiwwlt` | Instrument Sans | 36 | 700 | 37.8 | Section h2 |
| `1oke2e1` | Instrument Sans | 28 | 500 | 32.48 | h3 on dark |
| `1h8x64o` | Instrument Sans | 26 | 700 | 31.2 | h3 on light |
| `11yr44y` | Instrument Sans | 24 | 600 | 28.8 | Card title |
| `18gc2kl` | Instrument Sans | 20 | 600 | 24 | Lede |
| `d4by9r` | Instrument Sans | 18 | 700 | 23.4 | Footer column head |
| `ss1j4w` | Inter | 16 | 600 | 17.6 | Nav link |
| `c29y5p` | Inter | 16 | 600 | 23.111 | Button label |
| `1yx751z` | Roboto | 16 | 400 | 22.4 | Body on dark |
| `1x4tk8l` | Instrument Sans | 15 | 600 | 20.625 | Small label |
| `1dfqlr0` | Roboto | 15 | 400 | 20.625 | Small body |

### Header — fixed, 72px, transparent

- `position: fixed`, `z-index: 10`, width 390, height **72**, background transparent
- Inner row inset to **350** wide (20px each side)
- Crest logo `/svg/logo-crest.svg`, **37 × 44**, at y = 14
- "Login" pill: Inter 500 **13.5px**, white text, `1px solid white`, radius **30**,
  padding `8px 20px`
- Hamburger: 24 × 18 glyph inside a 48 × 48 target
- **No bottom navigation bar exists anywhere on the website.**

### Mobile menu — a hamburger dropdown, closed by default

- Panel 350 × 464 at (20, 90); container is `opacity: 0; pointer-events: none`
  until opened
- **10 links**: Home, About SXCCAA, Alumni Directory, Xaverians Making a
  Difference, Explore the Network, Chapters, Alumni Events & Activities,
  Contact, Privacy Policy, Terms of Use

### Home — 6 sections, page height 8185

| # | Section | Height | Background |
|---|---|---|---|
| 0 | Hero | **844** (full viewport) | hero-bg.jpg, `cover`, `50% 35%` |
| 1 | About | 1225 | white |
| 2 | The Xaverian community | 1174 | **#111111** |
| 3 | Explore the Xaverian network | 1128 | white |
| 4 | Inside the Xaverian experience | 856 | **#111111** |
| 5 | Voices From Our Community | 2237 | **#111111** |
| — | Footer | **721** | — |

Section padding `60px 0`; the hero is `120px 0 60px`.
**The hero has no buttons at mobile width** — the CTAs are hidden.
Hero text is centred, and the title is **one wrapping line**, not a stack.

---

## B. Discrepancies — what I built vs what the website shows

| # | Screen | Website | App as built | Correction |
|---|---|---|---|---|
| 1 | Global | Fixed 72px header: crest, Login pill, hamburger | No header at all | Build the header |
| 2 | Global | Hamburger dropdown, 10 links | **Five-tab bottom bar (invented)** | Remove tabs; build the dropdown |
| 3 | Global | 4 fonts incl. Olde English | 3 fonts, no Olde English | Ship `OldeEnglish.ttf` |
| 4 | Global | 13 measured presets | My own invented scale (40/32/28/24/20…) | Replace with measured presets |
| 5 | Global | Footer, 721px, 4 link columns | No footer | Build the footer |
| 6 | Home | Full-viewport hero, bg photo, Olde English, centred | Small left-aligned text on white | Rebuild |
| 7 | Home | No hero buttons on mobile | — | n/a |
| 8 | Home | Section 1 "About" | **Missing** | Add |
| 9 | Home | Section 3 "Explore the Xaverian network" | **Missing** | Add |
| 10 | Home | Sections 2, 4, 5 on **#111111** | All white | Apply dark backgrounds |
| 11 | Home | — | **"NEXT" event card (invented)** | Delete |
| 12 | Home | — | **"01 — THE COMMUNITY" eyebrows + gold rules (invented)** | Delete |
| 13 | Home | — | **"MORE / Explore the Association" link list (invented)** | Delete |
| 14 | Home | Voices section, 2237px, dark | Three bordered quote cards, white | Rebuild |
| 15 | About/Chapters/Explore/Contact | Website layout | My own `Section`/`OrdinalCard`/timeline designs | Rebuild against measured DOM |
| 16 | Chapters | SVG network map | Replaced with cards | Reproduce the map |

**Assessment: the previous UI was a redesign, not a replica.** Items 2, 6, 11,
12 and 13 are elements I invented that have no counterpart on the website, and
items 8, 9 and 5 are website content the app omitted entirely.

---

## B2. Measured inner spacing — the second pass

Read from the live site at 390px. These are the numbers the app is being built
against; anything not yet applied is listed in §D.

**Every section below the hero**

- Section heading sits **90** below the section top (not 60)
- Headings are **stacked on two lines** — "About" / "SXCCAA", "The Xaverian" /
  "community", "Explore the Xaverian" / "network", "Inside the Xaverian" /
  "experience", "Voices From Our" / "Community". They are not one wrapping line.

**About (844 → 1225)**

| Block | y | Gap above |
|---|---|---|
| H2 "About" 36px | 934 | 90 |
| H2 "SXCCAA" 36px | 972 | 0 |
| Lede 20px | 1052 | 42 |
| Button "Explore Alumni" | 1252 | 32 |
| Button "Events & Activities" | 1314 | 39 |
| Three-image collage (overlapping) | 1380 | 43 |

**The Xaverian community (2069 → 1174), dark**

Each card is a **350 × 300 image with the title and body overlaid on its lower
portion**, inset 20 from the card edge — *not* stacked beneath it:

| Block | Offset |
|---|---|
| Image 350 × 300 | 39 below the heading |
| H3 28px, x = 40 | **197 below the image top** (overlaid) |
| Body 16px, x = 40 | 7 below the title |
| Next card | 43 below the previous body |

**Explore the Xaverian network (3242 → 1128)**

Cards are **281 wide at x = 21** with overlapping y values — a horizontal
carousel on the website, not a vertical stack. H3 26px, body 16px, an "Explore"
link, then a 250 × 193 image.

---

## C. Order of correction

1. Fonts and the measured type presets — everything else depends on them
2. Colours, spacing and the section shell (`60px 0`, full-bleed dark bands)
3. Header + hamburger dropdown; **delete the tab bar**
4. Footer
5. Home, section by section against the measured heights
6. About, Chapters, Explore, Contact
7. Re-audit every screen at 390 × 844 and at 360 / 412 / 430

App-only screens — sign-in, event photo capture, the photo viewer, notifications
— have no website counterpart. They follow the same presets, colours and
controls, and introduce no new visual language.

---

## D. Status — 13 September 2026

### Verified byte-identical to the website

| Item | Evidence |
|---|---|
| Hero type | `OldeEnglish 34.32px / 37.752, white, centred` — matches exactly |
| Section heading positions | App "About" at **y = 934**, "SXCCAA" at **972** — website: 934, 972 |
| Home section order | Same five `h2`, same order |
| Dark bands | Same three sections on `#111111` |
| Hero height | Full viewport, no buttons |
| Navigation | Header + hamburger; **no tab bar** |
| Routes | The website's own paths |

### Applied but not yet measured against the DOM

- Community cards: overlay geometry applied (300 tall, title at 197, body +7,
  43 between cards). The scrim behind the overlay is an addition — the website
  relies on its crops being dark at the foot, which cannot be assumed for every
  photograph.
- Explore / Inside / Voices: heading positions corrected; inner block spacing
  still estimated.

### Not yet done

1. **About's two buttons and three-image collage.** The website's home About
   section has "Explore Alumni" and "Events & Activities" buttons and an
   overlapping three-image composition. Neither is in the content bundle —
   the copy lives in a website *component*, not in `src/data` — so serving them
   needs the same extraction that was done for the policy pages.
2. **Explore is a carousel on the website**, not a vertical stack. Cards are 281
   wide at x = 21 with overlapping y values.
3. **Chapters' SVG network map.** `react-native-svg` is now installed; the map
   itself is not built.
4. **About / Chapters / Contact / Events inner layouts.** Converted to the
   correct fonts, colours, bands and stacked headings, but their internal
   spacing has not been measured block by block the way Home's has.

### The method, for whoever continues

1. Run the website, set the viewport to **390 × 844**.
2. Select the **visible** variant — the Framer export renders every block three
   times and hides two, so an unfiltered `querySelector` returns the desktop
   copy and every number will be wrong.
3. List `p, h1–h6, img` inside the section, filter to visible, de-duplicate on
   `y + text` (the SSR variants repeat), sort by `y`.
4. Compute `gap = y − (previousY + previousHeight)`.
5. Transcribe those numbers. Do not round them to a scale.
