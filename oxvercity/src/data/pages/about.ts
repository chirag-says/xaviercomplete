import type { SiteImage } from '@/lib/images';

/**
 * Content of the about page's data-driven sections.
 *
 * Every figure below is an institutional fact published on sxccal.edu. There
 * are deliberately no alumni figures: the Association has not supplied the
 * alumni dataset, and inventing one would misrepresent the client.
 */

/* -------------------------------------------------------------------------- */
/* Mission, vision and legacy — the accordion                                   */
/* -------------------------------------------------------------------------- */

export interface Pillar {
  /** Used as the element id, so /about#mission opens that panel. */
  id: string;
  /** The number shown in the header rail: "01", "02", "03". */
  ordinal: string;
  title: string;
  summary: string;
  points: string[];
}

/**
 * The three panels of the "What the College stands for" accordion. Exactly one
 * is open; the first opens by default.
 */
export const pillars: Pillar[] = [
  {
    id: 'mission',
    ordinal: '01',
    title: 'Our mission',
    summary:
      'To unite Xaverians across the West Zone, nurturing fellowship, service and the enduring Xaverian spirit among alumni who have built their lives in western India.',
    points: [
      'Bringing Xaverians together across the West Zone',
      'Fostering a culture of service and social responsibility',
      'Keeping the Xaverian bond alive beyond college years',
    ],
  },
  {
    id: 'vision',
    ordinal: '02',
    title: 'Our vision',
    summary:
      'To be the most active and connected alumni chapter in the network — a community where every West Zone Xaverian feels seen, valued and at home.',
    points: [
      'Build a thriving alumni network across the West Zone',
      'Create meaningful opportunities for reconnection and growth',
      'Represent the Xaverian name with pride in the west',
    ],
  },
  {
    id: 'legacy',
    ordinal: '03',
    title: 'Our legacy',
    summary:
      "Rooted in the same ideals of Nihil Ultra that defined our years at Xavier's, the West Zone Chapter carries that legacy forward — through gatherings, initiatives and a shared sense of belonging.",
    points: [
      'Grounded in the Jesuit ideals of our alma mater',
      'Guided by the motto Nihil Ultra in everything we do',
      'A legacy built together by generations of West Zone Xaverians',
    ],
  },
];

export const pillarsHeading = {
  eyebrow: 'What we stand for',
  /** One display line each, as the template stacks its section titles. */
  lines: ['Mission,', 'vision', 'and legacy'],
};

/* -------------------------------------------------------------------------- */
/* History of the College                                                       */
/* -------------------------------------------------------------------------- */

export interface Milestone {
  year: string;
  title: string;
  text: string;
}

/**
 * The West Zone Chapter's history and evolution.
 */
export const history = {
  eyebrow: 'Our Chapter',
  lines: ['History of', 'West Zone'],
  intro:
    "The West Zone Chapter of SXCCAA brings together Xaverians settled across western India — from Mumbai to Pune, Ahmedabad to Goa. What began as informal gatherings of former classmates has grown into a structured, active chapter proud to carry the Xaverian name in the west.",
  image: {
    src: '/images/about/since-1960-image.jpg',
    width: 1000,
    height: 667,
    widths: [512],
    alt: "West Zone SXCCAA chapter alumni gathering",
  } as SiteImage,
  milestones: [
    {
      year: 'The Beginning',
      title: 'Xaverians find each other in the west',
      text: "A small group of St. Xavier's alumni settled in Mumbai began meeting informally, drawn together by shared memories of the College, its corridors and the friendships forged there.",
    },
    {
      year: 'Formation',
      title: 'The West Zone Chapter is established',
      text: 'What started as informal reunions took formal shape when the West Zone Chapter was constituted under the SXCCAA umbrella — giving western Xaverians an official home and a collective voice.',
    },
    {
      year: 'Growing',
      title: 'Expanding across western India',
      text: 'The chapter grew beyond Mumbai, welcoming Xaverians from Pune, Ahmedabad, Goa and other cities across the west. Annual events, dinners and drives became fixtures of the chapter calendar.',
    },
    {
      year: 'Community',
      title: 'Service and fellowship in the west',
      text: "Inspired by the Jesuit ethos of Nihil Ultra, the chapter launched community initiatives — connecting alumni with each other and giving back to society in the spirit of the College's enduring mission.",
    },
    {
      year: 'Today',
      title: 'A vibrant, connected chapter',
      text: 'The West Zone Chapter today is an active, growing community of Xaverians — united by the College they shared, the values it instilled, and the friendships that have lasted a lifetime.',
    },
  ] satisfies Milestone[],
};

/* -------------------------------------------------------------------------- */
/* Why Xavier's                                                                 */
/* -------------------------------------------------------------------------- */

export interface Reason {
  ordinal: string;
  title: string;
  text: string;
}

export const why = {
  eyebrow: "Why Xavier's",
  lines: ['A tiny seed grown', 'into a mighty tree'],
  reasons: [
    {
      ordinal: '01',
      title: 'Heritage and tradition',
      text: "St. Xaviers College (Calcutta) is a 166-year-old institution with a rich heritage and a long tradition.",
    },
    {
      ordinal: '02',
      title: 'A Jesuit education',
      text: 'As a Jesuit higher educational institution, it aims to form men and women for others, with fundamental human and spiritual values.',
    },
    {
      ordinal: '03',
      title: 'From 83 students to 8,614',
      text: 'The tiny seed has grown into a mighty tree: from 83 students in 1860 to 8,614 students in December 2024.',
    },
    {
      ordinal: '04',
      title: 'Three shifts, five faculties',
      text: 'The College functions in three shifts — morning, day and evening — offering UG and PG courses in Humanities, Science, Education, Commerce and Business Administration.',
    },
  ] satisfies Reason[],
};

/* -------------------------------------------------------------------------- */
/* The College                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What the rest of the page does not already say about the College: the four
 * marks a Jesuit formation is measured by, the motto in translation, and the
 * affiliations and programmes. The founding, the student numbers, the faculties
 * and the mission are stated elsewhere on the page and are not repeated here.
 */
export const college = {
  eyebrow: 'The Chapter',
  lines: ['Four marks', 'of a', 'West Zone Xaverian'],
  lead: "The West Zone Chapter carries forward the same four values that St. Xavier's College instilled in every one of us — the marks by which a Xaverian is known, wherever they are.",
  /** The four Cs — Xaverian values the West Zone alumni carry forward. */
  marks: ['Competence', 'Commitment', 'Conscience', 'Compassion'],
  motto: {
    eyebrow: 'The motto',
    latin: 'Nihil Ultra',
    gloss: 'Nothing Beyond',
  },
  /** The rail under the motto — West Zone chapter facts. */
  facts: [
    { label: 'Zone', value: 'Western India' },
    { label: 'Cities', value: 'Mumbai, Pune, Ahmedabad, Goa and beyond' },
    { label: 'Spirit', value: 'Nihil Ultra — nothing beyond' },
    { label: 'Community', value: 'Alumni events, drives and reconnections' },
  ],
};

export interface FactCard {
  /** The number the counter ends on, e.g. 1860 for "1860". */
  value: number;
  suffix: string;
  /** Set instead of `value` where the fact is not a number, e.g. "A++". */
  display?: string;
  /** Thousands separators: right for a count, wrong for a year. */
  group?: boolean;
  title: string;
  description: string;
}

/** The three fact cards under the story images. Each counts up when scrolled into view. */
export const facts: FactCard[] = [
  {
    value: 0,
    suffix: '',
    display: 'West',
    title: 'Zone Chapter',
    description: 'The SXCCAA West Zone Chapter — uniting Xaverians settled across western India.',
  },
  {
    value: 4,
    suffix: '+',
    group: false,
    title: 'Major Cities',
    description: 'Alumni across Mumbai, Pune, Ahmedabad, Goa and other cities in the west.',
  },
  {
    value: 0,
    suffix: '',
    display: 'Nihil Ultra',
    title: 'Our Motto',
    description: 'The Xaverian standard we carry forward — nothing beyond, in everything we do.',
  },
];

export interface StatLine {
  value: number;
  suffix: string;
  /** Set instead of `value` where the fact is not a number. */
  display?: string;
  group?: boolean;
  text: string;
  /** Width the underline fills to, as on the original (92% and 30%). */
  lineWidth: string;
}

/** The two lines beside the "Since 1860" card. */
export const statLines: StatLine[] = [
  { value: 0, suffix: '', display: 'A++', text: 'The accreditation grade awarded to the College by NAAC', lineWidth: '92%' },
  { value: 0, suffix: '', display: 'Nihil Ultra', text: 'The College motto, and the standard every Xaverian is held to', lineWidth: '30%' },
];

/**
 * Not rendered. This was the "Since 1860" lead beside the banner title, and
 * before that a card in the info section; it has been taken off the page. The
 * copy is kept here rather than deleted so putting it back is one element in
 * `AboutBanner`, but nothing imports it today — and the search index no longer
 * offers it, because the page no longer shows it.
 */
export const bannerLead = {
  eyebrow: 'Since 1860',
  lead: 'A legacy that continues, carried forward by every Xaverian.',
  text: "Founded in 1860 by the Society of Jesus, St. Xaviers College (Calcutta) has grown into a leading institution of higher education while remaining rooted in its Jesuit educational tradition.",
};

/** The badge over the info section's photograph. */
export const aboutCard = {
  badgeValue: 'Est. 1860',
  badgeLabel: 'Jesuit tradition',
};

export interface NewsCard {
  category: string;
  date: string;
  title: string;
  href: string;
  image: SiteImage;
}

/**
 * "From the Xaverian community". Each item is drawn from the College's own
 * bulletin; the cards link out to sxccal.edu because this prototype has no
 * story pages of its own.
 */
export const news: NewsCard[] = [
  { category: 'College News', date: '25 August 2026', title: 'Xaverians shine at SEBI NFLQ 2026', href: 'https://www.sxccal.edu/', image: { src: '/images/news/pioneering-education-for-the-future-of-2025.jpg', width: 3840, height: 2400, widths: [512, 1024, 2048], alt: 'Thumbnail Image' } },
  { category: 'Students', date: '2026', title: 'Six students receive the UN Millennium Fellowship 2026', href: 'https://www.sxccal.edu/', image: { src: '/images/news/innovative-projects-from-our-research-teams.jpg', width: 3840, height: 2160, widths: [512, 1024, 2048], alt: 'Thumbnail Image' } },
  { category: 'Community', date: '22 August 2026', title: 'Ripples of Hope, an SXCCAA initiative at Bodhona', href: 'https://www.sxccal.edu/', image: { src: '/images/news/alumni-achievements-that-inspire.jpg', width: 8256, height: 5504, widths: [512, 1024, 2048, 4096], alt: 'Thumbnail Image' } },
  { category: 'College News', date: 'August 2026', title: "Students' Council Election 2026", href: 'https://www.sxccal.edu/', image: { src: '/images/news/integrating-tech-into-modern-education.png', width: 1472, height: 1200, widths: [512, 1024], alt: 'Thumbnail Image' } },
];
