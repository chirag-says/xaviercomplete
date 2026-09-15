import type { SiteImage } from '@/lib/images';

/**
 * "Chapters" — the West Zone chapter, at /chapters.
 *
 * One chapter, and only what SXCCAA has published about it. Everything here is
 * read either off the poster the Association issued for the 2023 meet or off
 * sxccaa.org, which is the chapter's own site. Two things on that poster are
 * deliberately left in the artwork and not repeated as text: the donor-pass
 * mobile numbers and the UPI id. Showing the poster is one thing; setting
 * personal numbers and a payment handle as machine-readable copy on a public
 * page is another.
 */

export const westZone = {
  eyebrow: 'SXCCAA Chapter',
  /** Set one word to a line in the hero. */
  headline: ['West', 'Zone'],
  city: 'Mumbai',
  lede: 'The Association in the west of India, and the meets it brings Xaverians together for.',

  meet: {
    title: 'Xaverians Nostalgia ’23',
    subtitle: 'West Zone Mega Meet',
    date: 'Saturday, 26 August 2023',
    place: 'Jade Hall, Hotel Sahara Star, Mumbai',
    /** What the day held, in the poster's own words. */
    bill: ['4 intellectual panels', 'Bollywood fireside chat', 'Awards night', 'Gala dinner'],
    /** The four panels, as the poster sets them. */
    panels: [
      { title: 'Markets & Economy', detail: 'Optics and substance of FII / FDI in India' },
      { title: 'Start up', detail: 'Navigating the funding winter and consequent challenges' },
      { title: 'Mental Health & Wellness', detail: 'Mantras for Love you Zindagi' },
      { title: 'Women Impact', detail: 'Breaking barriers and leading with impact' },
    ],
    note: 'Fifteen industry leaders, subject experts and Xaverian honchos across four panels, and a fireside chat marking Raj Kapoor’s birth centenary.',
    names: ['Bickram Ghosh', 'Prasenjit Chatterjee', 'Arindam Sil', 'Karishma Kapoor', 'Randhir Kapoor'],
  },

  /**
   * The chapter's own poster, and the only artwork SXCCAA has issued for West
   * Zone itself. It leads the chapter section. The 2026 poster is deliberately
   * not shown anywhere on this page — that one is a record of an event, and
   * /events already carries it.
   */
  poster: {
    src: '/images/chapters/nostalgia-23.jpg',
    width: 1280,
    height: 720,
    widths: [512, 1024],
    alt:
      "Poster for Xaverians Nostalgia '23, the SXCCAA West Zone Mega Meet, Saturday 26 August 2023 at Jade Hall, Hotel Sahara Star, Mumbai. It lists four panel discussions, a Bollywood fireside chat, an awards night and a gala dinner, and shows Bickram Ghosh, Prasenjit Chatterjee, Arindam Sil, Karishma Kapoor and Randhir Kapoor.",
  } as SiteImage,

  next: {
    label: 'Next from the chapter',
    title: 'Nostalgia ’26 cum Shakti',
    date: '3 October 2026 · Taj Santacruz, Mumbai',
    href: '/events',
  },

  source: { label: 'sxccaa.org', href: 'https://www.sxccaa.org/' },
  contact: { label: 'Contact SXCCAA', href: '/contact' },
};

/* -------------------------------------------------------------------------- */
/* The page's own framing                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The opening. The headline is editorial — it is the Association's idea about
 * itself, set in its own words — and asserts nothing that is not already true
 * of the two places named further down. The rail under it is three facts and
 * nothing else: how many chapters there are, where the Association sits, and
 * the next thing the chapter is doing.
 */
export const chaptersPage = {
  eyebrow: 'SXCCAA · The Xaverian Network',
  /** One line per array entry; each rises out of its own row. */
  headline: ['Wherever', 'Xaverians go,', 'the connection', 'remains.'],
  cue: 'The meets',
  posterCue: 'View the poster',
  /** Read off `westZone`, `site.ts` and the College's own history. */
  rail: [
    { key: 'chapters', figure: '01', label: 'Chapter', value: 'West Zone' },
    { key: 'seat', figure: '1860', label: 'The College, since', value: 'Calcutta' },
    { key: 'next', figure: '03.10.26', label: 'Next meet', value: 'Mumbai' },
  ],
};

/* -------------------------------------------------------------------------- */
/* The network                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The two places the Association is, drawn as a network.
 *
 * SXCCAA has published one chapter, so this has two nodes and one line: the
 * seat in Calcutta and the chapter in the west. Nothing is inferred to fill
 * the picture out — no coordinates, no third city, no membership figures.
 * `x` and `y` are positions in the SVG's own 1000 × 260 box, chosen so the
 * composition reads left-to-right the way the two cities sit on the map;
 * they are not a projection, and the section says so under the drawing.
 *
 * `anchor` is the id of the section the node scrolls to when it is activated,
 * so the drawing is navigation as well as a picture.
 */
export interface NetworkNode {
  key: string;
  /** Position in the 1000 × 260 viewBox. Compositional, not geographic. */
  x: number;
  y: number;
  city: string;
  role: string;
  /** The one line of detail that appears when the node is live. */
  detail: string;
  meta: string;
  /** Section id this node links to, or null where it only reads. */
  anchor: string | null;
  /** The link's own words. Present only where there is an anchor. */
  action?: string;
  /** The node the Association itself sits at, drawn a size larger. */
  seat?: boolean;
}

export const network = {
  eyebrow: '05 — The network',
  title: ['Two cities.', 'One Association.'],
  lede:
    'The Association is seated in Calcutta. In the west of India it meets as the West Zone chapter.',
  /** Under the drawing, so no one reads it as a map. */
  caption: 'Drawn for composition, not to scale.',
  hint: 'Select a point',
  nodes: [
    {
      key: 'mumbai',
      x: 196,
      y: 150,
      city: 'Mumbai',
      role: 'West Zone Chapter',
      detail: 'Xaverians Nostalgia',
      meta: 'Next meet · 3 October 2026',
      action: 'See the meets',
      anchor: 'meets',
    },
    {
      key: 'calcutta',
      x: 804,
      y: 78,
      city: 'Calcutta',
      role: 'The Association',
      detail: '30, Mother Teresa Sarani',
      meta: "St. Xavier's College · since 1860",
      anchor: null,
      seat: true,
    },
  ] as NetworkNode[],
};

/* -------------------------------------------------------------------------- */
/* The chapter, and the meets it holds                                          */
/* -------------------------------------------------------------------------- */

/**
 * The meets. `nostalgia-26` is read from the events file rather than copied,
 * so the date only ever has to be right in one place.
 */
export const meetsSection = {
  eyebrow: '02 — The meets',
  title: 'What the chapter gathers for',
};

export const billSection = {
  eyebrow: '03 — On the bill',
  title: 'Four panels, one long evening',
};

export const joinSection = {
  eyebrow: '04 — Attending',
  title: 'Passes and payment',
  note: 'Rates and the payment handle are shown exactly as the Association issued them.',
};

/**
 * The foot. There was a closing statement here and it has been removed — the
 * network is the last thing said now — so this is only the way on.
 */
export const closing = {
  cta: { label: 'Explore the alumni directory', href: '/alumni' },
};
