import type { SiteImage } from '@/lib/images';
import { eventsCta } from '@/data/site';

/**
 * Content of the home page's data-driven sections. Layout lives in the
 * components; change text and images here.
 *
 * Nothing in this file asserts a fact about the alumni body — no counts, no
 * names, no achievements — because the Association has not supplied the
 * alumni dataset yet. Statements about the College come from sxccal.edu.
 */

/**
 * The hero: the College named across the top, the heading and the buttons down
 * the lower left, the founding year small at the bottom right.
 *
 * The College's name, address and founding are the only facts asserted here,
 * and all three are on sxccal.edu.
 */
export const hero = {
  /** The College, centred at the top, one entry per word so it can wrap. */
  display: ["St.", "Xaviers", 'College', '(Calcutta)'],
  /** The Association's own line, under the College's name. */
  subtitle: 'Alumni Association West Zone Chapter',
  /**
   * Both buttons now sit in the About section below the hero. The second one
   * is the shared events link rather than its own literal, so the label and
   * the route stay in step with the header, the footer and the network
   * section, which all point at the same page.
   */
  primaryCta: { label: 'Explore Alumni', href: '/alumni' },
  secondaryCta: eventsCta,
};

export interface FacultySlide {
  tag: string;
  title: string;
  description: string;
  /**
   * Every card carries one now. A slide left without an image falls back to a
   * "coming soon" plate rather than a stock photograph, which is how a new
   * card can be added before SXCCAA has supplied its picture.
   */
  image?: SiteImage;
}

/**
 * "The Xaverian community": the slideshow on desktop and tablet, and the same
 * cards stacked on phone. One list for all three — the phone used to carry its
 * own hardcoded set in a different order, so the two had already drifted apart.
 */
export const faculties: FacultySlide[] = [
  {
    tag: 'SXCCAA',
    title: 'Alumni',
    description:
      'Reconnect with Xaverians across generations, disciplines, professions and locations — and find the people whose path you want to follow.',
    /* the same photograph the About section carries below the hero, used
       once and pointed at twice rather than copied into a second file */
    image: {
      src: '/images/home/about-slide-1.jpg',
      position: '50% 52%',
      width: 1447,
      height: 1087,
      widths: [512, 1024],
      alt: 'A Xaverian raising her diploma on the College grounds on graduation day',
    },
  },

  {
    tag: 'SXCCAA',
    title: 'Initiatives',
    description:
      "Discover the Association's initiatives, activities and contribution to the wider community, from fellowship to philanthropy.",
    image: {
      src: '/images/home/community-initiatives.jpg',
      position: '50% 62%',
      width: 1672,
      height: 941,
      widths: [512, 1024],
      alt: "An SXCCAA display on the College veranda, headed Alumni for a Brighter Tomorrow, with alumni and staff looking on",
    },
  },

  {
    tag: 'SXCCAA',
    title: 'Events',
    description:
      'Follow the gatherings, championships and chapter meets held by the Association and its forums — what has already taken place, and what is still to come.',
    image: {
      src: '/images/home/community-events.jpg',
      position: '50% 38%',
      width: 1536,
      height: 1024,
      widths: [512, 1024],
      alt: "An SXCCAA Alumni Meet in the College hall: a speaker at the lectern before a full house, under a banner reading Reconnect, Relive, Reignite",
    },
  },

];

export interface CampusCard {
  title: string;
  description: string;
  image: SiteImage;
}

/** "Inside the Xaverian experience": four cards in two columns. */
export const campusCards: CampusCard[] = [
  { title: 'Campus', description: "St. Xaviers College (Calcutta) — 30, Mother Teresa Sarani, in the heart of the city.", image: { src: '/images/home/campus-raghabpur.jpg', width: 1348, height: 442, widths: [512, 1024], alt: "St. Xaviers College (Calcutta) campus" } },
  { title: 'Academics', description: 'Humanities, Science, Commerce, Business Administration and Education.', image: { src: '/images/home/campus-libraries.jpg', width: 2832, height: 4256, widths: [1024, 2048, 4096], alt: 'Card Image', position: '59.4% 15.1%' } },
  { title: 'Life at Xavier\'s', description: 'Sports, fitness, societies and the vibrant campus culture that shapes every Xaverian.', image: { src: '/images/home/campus-gym.jpg', width: 6755, height: 4508, widths: [512, 1024, 2048, 4096], alt: 'Card Image' } },
];

/**
 * The home page's About band.
 *
 * Extracted from `src/components/home/AboutSection.tsx` so the mobile app can
 * render the same words and the same composition through
 * `/api/app/v1/content`. Copy that lives only inside a React component is copy
 * the app cannot show without a hand-maintained duplicate that drifts — the same
 * reasoning that moved the policy documents into src/data.
 *
 * The buttons are not repeated here: they are `hero.primaryCta` and
 * `hero.secondaryCta`, which the section already reuses.
 *
 * `collage` records the three overlapping images as measured on the live page at
 * 390px — a 350 × 129 stage with each image placed by offset. It is a
 * composition, not a stack, so the numbers matter.
 */
export const homeAbout = {
  heading: ['About', 'SXCCAA'],
  lede:
    'A community that carries the Xaverian spirit forward. SXCCAA connects Xaverians through fellowship, initiatives and engagement with their alma mater, strengthening the bond between alumni and the College.',
  collage: {
    stage: { width: 350, height: 129 },
    images: [
      { src: '/images/home/about-slide-1.jpg', width: 1447, height: 1031, widths: [512, 1024],
        alt: 'Xaverians at an Association gathering', left: 85, top: 0, w: 181, h: 129 },
      { src: '/images/home/about-emrc.png', width: 1733, height: 3100, widths: [512, 1024],
        alt: 'The College EMRC building', left: 194, top: 5, w: 66, h: 118 },
      { src: '/images/home/about-crest.png', width: 1144, height: 2150, widths: [512, 1024],
        alt: "St. Xavier's College Calcutta crest", left: 94, top: 9, w: 59, h: 111 },
    ],
  },
} as const;
