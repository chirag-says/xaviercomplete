/**
 * The website's design system, measured — not designed.
 *
 * **Every value in this file was read from the live website at 390 × 844** with
 * `getComputedStyle`, not chosen. The app is a 1:1 reproduction of the website's
 * mobile view, so there is nothing here to have an opinion about: if a number
 * looks odd (34.32px, 23.111px line-height), it is odd on the website too and it
 * stays.
 *
 * An earlier version of this file was a tidied-up scale of my own invention —
 * 40 / 32 / 28 / 24 / 20 — which is why the app stopped looking like the site.
 * Do not "clean these up".
 *
 * ## The four fonts
 *
 * Three were obvious. The fourth was not: the hero is set in **Olde English**, a
 * blackletter face served from `/fonts/OldeEnglish.ttf` — the only `.ttf` among
 * the eighty files in `public/fonts/`, the rest being `.woff2`. It renders the
 * two most prominent lines on the site, and missing it was the single largest
 * visual error in the first build.
 *
 * ## Re-measuring
 *
 * Run the website, set the viewport to 390 wide, and read
 * `framer-styles-preset-*` off the **visible** variant of each block. The Framer
 * export renders every block three times and hides two, so an unfiltered
 * querySelector returns the desktop copy and every number will be wrong.
 */

export const colour = {
  /** rgb(17,17,17) — body copy, and the background of three home sections. */
  ink: '#111111',
  /** The dark band background. Identical to `ink`; named for intent. */
  dark: '#111111',

  white: '#ffffff',
  /** rgba(255,255,255,0.8) — body copy on the dark bands (preset 1yx751z). */
  onDark: 'rgba(255,255,255,0.8)',
  /** Hairlines on dark. */
  onDarkFaint: 'rgba(255,255,255,0.15)',

  ink70: 'rgba(17,17,17,0.70)',
  ink55: 'rgba(17,17,17,0.55)',
  ink08: 'rgba(17,17,17,0.08)',

  grey: '#f8f8f8',
  plate: '#f5f5f5',
  cream: '#f7f3ec',
  paper: '#f7f6f3',

  navy: '#133e6d',
  navySoft: 'rgba(19,62,109,0.08)',
  gold: '#c5a55a',
  maroon: '#8b2332',
  accent: '#ff2244',

  /** The accordion hairline on white — `rgba(17,17,17,0.15)`, measured. */
  rule: 'rgba(17,17,17,0.15)',

  /**
   * Page-specific darks. Neither is `#111111`, and using `ink` for them is a
   * visible error: `/chapters` is a degree cooler, `/events` is violet.
   */
  chaptersInk: '#0b0b0c',
  eventsInk: 'rgb(20,12,39)',

  /** The About slider's EMRC panel. */
  emrc: 'rgb(147,240,239)',
} as const;

/**
 * Font family names as registered with expo-font in app/_layout.tsx.
 *
 * `OldeEnglish` ships as a real .ttf copied from the website. The other three
 * come from @expo-google-fonts, which supplies the identical typefaces — the
 * website's own copies are .woff2, which React Native cannot load.
 */
export const font = {
  olde: 'OldeEnglish',
  instrument: 'InstrumentSans_400Regular',
  instrumentMedium: 'InstrumentSans_500Medium',
  instrumentSemi: 'InstrumentSans_600SemiBold',
  instrumentBold: 'InstrumentSans_700Bold',
  roboto: 'Roboto_400Regular',
  robotoMedium: 'Roboto_500Medium',
  interSemi: 'Inter_600SemiBold',
  interMedium: 'Inter_500Medium',
  /** The Voices standfirst and role lines are Inter 400, not 500. */
  inter: 'Inter_400Regular',
} as const;

/**
 * The website's type presets, measured at 390px.
 *
 * Keys are the Framer preset ids so a value can be traced back to the DOM node
 * it came from — `framer-styles-preset-1y2slg` is the hero title, and searching
 * that string in the website's markup finds every place it is used.
 *
 * `maxScale` is the one thing here that is not from the website: it caps
 * `maxFontSizeMultiplier` so a user at 310% accessibility text does not destroy
 * the layout. The web has no equivalent, and leaving it uncapped is worse than
 * a considered ceiling.
 */
export const preset = {
  /** 1y2slg — hero title. "St. Xaviers College (Calcutta)" */
  heroTitle: { fontFamily: font.olde, fontSize: 34.32, lineHeight: 37.752, color: colour.white, maxScale: 1.3 },
  /** 1o91uer — hero subtitle. "Alumni Association" */
  heroSubtitle: { fontFamily: font.olde, fontSize: 21, lineHeight: 24.36, color: colour.white, maxScale: 1.3 },
  /** 1tiwwlt — section h2 */
  h2: { fontFamily: font.instrumentBold, fontSize: 36, lineHeight: 37.8, color: colour.ink, maxScale: 1.3 },
  /** 1oke2e1 — h3 on a dark band */
  h3OnDark: { fontFamily: font.instrumentMedium, fontSize: 28, lineHeight: 32.48, color: colour.white, maxScale: 1.4 },
  /** 1h8x64o — h3 on white */
  h3: { fontFamily: font.instrumentBold, fontSize: 26, lineHeight: 31.2, color: colour.ink, maxScale: 1.4 },
  /** 11yr44y — card title, on dark */
  cardTitle: { fontFamily: font.instrumentSemi, fontSize: 24, lineHeight: 28.8, color: colour.white, maxScale: 1.4 },
  /** 18gc2kl — lede */
  lede: { fontFamily: font.instrumentSemi, fontSize: 20, lineHeight: 24, color: colour.ink, maxScale: 1.6 },
  /** d4by9r — footer column heading */
  columnHead: { fontFamily: font.instrumentBold, fontSize: 18, lineHeight: 23.4, color: colour.ink, maxScale: 1.4 },
  /** ss1j4w — navigation link */
  navLink: { fontFamily: font.interSemi, fontSize: 16, lineHeight: 17.6, color: colour.ink, maxScale: 1.4 },
  /** c29y5p — button label */
  button: { fontFamily: font.interSemi, fontSize: 16, lineHeight: 23.111, color: colour.white, maxScale: 1.4 },
  /** 1yx751z — body copy on a dark band */
  bodyOnDark: { fontFamily: font.roboto, fontSize: 16, lineHeight: 22.4, color: colour.onDark, maxScale: 1.8 },
  /** Body copy on white. Same metrics as bodyOnDark, ink instead. */
  body: { fontFamily: font.roboto, fontSize: 16, lineHeight: 22.4, color: colour.ink, maxScale: 1.8 },
  /** 1x4tk8l — small label */
  label: { fontFamily: font.instrumentSemi, fontSize: 15, lineHeight: 20.625, color: colour.ink, maxScale: 1.6 },
  /** 1dfqlr0 — small body */
  small: { fontFamily: font.roboto, fontSize: 15, lineHeight: 20.625, color: colour.ink, maxScale: 1.8 },
  /**
   * The Login pill in the header. Measured: Inter 500, 13.5px, **line-height
   * 13.5** — the pill is 31.5 tall (8 + 13.5 + 8 + 2 borders), and an 18px
   * line-height made it 36.
   */
  loginPill: { fontFamily: font.interMedium, fontSize: 13.5, lineHeight: 13.5, color: colour.white, maxScale: 1.3 },

  /*
   * The Voices section. These are not Framer presets — `voices.css` is
   * hand-written and sets its own type, stepped down at the phone tier. Read
   * from the live card at 390 × 844.
   */
  /** `.sx-voices__standfirst`, ≤809.98px: Inter 400 15 / 23.25. */
  voiceStandfirst: { fontFamily: font.inter, fontSize: 15, lineHeight: 23.25, color: 'rgba(255,255,255,0.76)', maxScale: 1.6 },
  /** `.sx-voice__quote`, ≤860px tall: Inter 500 15 / 23.25. */
  voiceQuote: { fontFamily: font.interMedium, fontSize: 15, lineHeight: 23.25, color: colour.white, maxScale: 1.5 },
  /** `.sx-voice__monogram`: Instrument Sans 700 19, line-height 1. */
  voiceMonogram: { fontFamily: font.instrumentBold, fontSize: 19, lineHeight: 19, color: colour.white, maxScale: 1.2 },
  /** `.sx-voice__name`: Instrument Sans 700 17 / 1.2. */
  voiceName: { fontFamily: font.instrumentBold, fontSize: 17, lineHeight: 20.4, color: colour.white, maxScale: 1.4 },
  /** `.sx-voice__role`: Inter 400 13 / 1.4. */
  voiceRole: { fontFamily: font.inter, fontSize: 13, lineHeight: 18.2, color: 'rgba(255,255,255,0.68)', maxScale: 1.5 },
} as const;

export type PresetName = keyof typeof preset;

/**
 * Layout constants, measured.
 *
 * `gutter` is 20: the header's inner row is 350 wide inside a 390 viewport, and
 * the section content matches. `headerHeight` is 72. `sectionPadV` is the
 * `60px 0` every section below the hero carries.
 */
export const layout = {
  gutter: 20,
  headerHeight: 72,
  sectionPadV: 60,
  heroPadTop: 120,
  heroPadBottom: 60,
  /** The Login pill, and **only** it: radius 30, padding 8 × 20, height 31.5. */
  pillRadius: 30,
  /** Pill right edge (300) to hamburger target left edge (322). */
  headerGap: 22,
} as const;

/**
 * The site's content button — measured, and not the same shape as the Login
 * pill.
 *
 * Every call to action in a page body is this: **radius 80**, padding
 * `12.5px 20px`, height 48.1, label Inter 600 16 / 23.111. The primary fill is
 * `#111111` with a white label; the secondary is `#f8f8f8` with an ink label.
 *
 * The first build drew these as 30-radius outlined pills with 8px padding,
 * which is the Login pill's geometry applied to the wrong control.
 */
export const button = {
  radius: 80,
  padV: 12.5,
  padH: 20,
  height: 48.1,
} as const;

/** Kept from the website's tokens.ts for the few places the app animates. */
export const motion = { ease: [0.44, 0, 0.56, 1] as const, duration: 400 } as const;

/**
 * Spacing and radii for the app-only screens.
 *
 * Sign-in, the session sheet and the Turnstile sheet have no website
 * counterpart to measure, so they need a scale. These follow the website's own
 * 4px rhythm and its measured radii (the Login pill is 30) rather than
 * introducing a different one.
 *
 * **Website pages must not use these.** Their spacing is measured per section
 * and lives in the page files, because a shared scale is how a reproduction
 * quietly turns back into a design system.
 */
export const space = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32, huge: 40, giant: 60 } as const;

export const radius = { sm: 10, md: 12, lg: 14, xl: 16, xxl: 30, pill: 30 } as const;
