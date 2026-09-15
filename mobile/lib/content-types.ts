/**
 * The shape of `GET /api/app/v1/content`.
 *
 * Mirrors the bundle assembled in oxvercity/src/app/api/app/v1/content/route.ts,
 * which in turn is the website's own src/data modules. Typed by hand rather than
 * generated: the website is a separate repository with no shared package (that
 * extraction was deliberately not done — see the plan's §3), so this file is the
 * contract, and `npm run app:verify` is what keeps the server honest about it.
 *
 * If a field is added on the server, the app keeps working and ignores it. If a
 * field is removed, `npm run typecheck` here is what notices.
 */

/** The website's image descriptor, from oxvercity/src/lib/images.ts. */
export interface SiteImage {
  src: string;
  width: number;
  height: number;
  /** Widths of the pre-scaled variants sitting beside the file. */
  widths?: number[];
  alt: string;
  /** CSS object-position on the web; maps to a resize anchor here. */
  position?: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface NavGroup {
  title: string;
  links: NavLink[];
}

export interface SiteSection {
  logo: {
    white: string;
    dark: string;
    watermark: string;
    crest: string;
    width: number;
    height: number;
    crestWidth: number;
    crestHeight: number;
  };
  name: string;
  associationName: string;
  associationShortName: string;
  motto: string;
  contact: {
    officeLabel: string;
    address: string[];
    addressHref: string;
    emailLabel: string;
    email: string;
    phone: string;
    phoneHref: string;
  };
}

export interface NavSection {
  main: NavLink[];
  pagesMenuLabel: string;
  pagesMenu: NavGroup[];
  mobile: NavLink[];
  headerCta: NavLink;
  eventsCta: NavLink;
  footerColumns: NavGroup[];
}

export interface HomeSection {
  hero: {
    display: string[];
    subtitle: string;
    primaryCta: NavLink;
    secondaryCta: NavLink;
  };
  faculties: Array<{ tag: string; title: string; description: string; image?: SiteImage }>;
  campusCards: Array<{ title: string; description: string; image: SiteImage }>;
  voices: Array<{ name: string; role?: string; comment: string }>;
  /**
   * The home page's About band, extracted from the website's AboutSection so
   * the app shows the same words and the same composition.
   *
   * `collage` is three overlapping images on a 350 x 129 stage, each placed by
   * offset — a composition, not a stack, so the numbers are load-bearing.
   */
  about: {
    heading: string[];
    lede: string;
    collage: {
      stage: { width: number; height: number };
      images: Array<SiteImage & { left: number; top: number; w: number; h: number }>;
    };
  };
}

export interface AboutSection {
  bannerLead: { eyebrow: string; lead: string; text: string };
  card: { badgeValue: string; badgeLabel: string };
  pillars: Array<{ id: string; ordinal: string; title: string; summary: string; points: string[] }>;
  pillarsHeading: { eyebrow: string; lines: string[] };
  history: {
    eyebrow: string;
    lines: string[];
    intro: string;
    image: SiteImage;
    milestones: Array<{ year: string; title: string; text: string }>;
  };
  why: {
    eyebrow: string;
    lines: string[];
    reasons: Array<{ ordinal: string; title: string; text: string }>;
  };
  college: {
    eyebrow: string;
    lines: string[];
    lead: string;
    marks: string[];
    motto: { eyebrow: string; latin: string; gloss: string };
    facts: Array<{ label: string; value: string }>;
  };
  facts: Array<{
    value: number;
    suffix: string;
    display?: string;
    group?: boolean;
    title: string;
    description: string;
  }>;
  statLines: Array<{
    value: number;
    suffix: string;
    display?: string;
    group?: boolean;
    text: string;
    lineWidth: string;
  }>;
}

export type Strand = 'community' | 'women' | 'sport' | 'fellowship';

export interface DateStamp {
  day?: string;
  month?: string;
  year: string;
}

export interface AlumniEvent {
  id: string;
  title: string;
  date: string;
  stamp: DateStamp;
  place: string;
  description: string;
  strands: Strand[];
  source?: { label: string; href: string };
  images: SiteImage[];
}

export interface EventsSection {
  page: {
    eyebrow: string;
    titleLead: string;
    titleTail: string;
    display: string[];
    headline: string[];
    intro: string;
    photoNote: string;
    featuredLabel: string;
    recordEyebrow: string;
  };
  strands: Array<{ id: Strand | 'all'; label: string }>;
  upcoming: {
    id: string;
    title: string;
    subtitle: string;
    host: string;
    date: string;
    iso: string;
    time: string;
    place: string;
    lede: string;
    poster: SiteImage;
  };
  featured: {
    id: string;
    title: string;
    date: string;
    place: string;
    description: string;
    source: { label: string; href: string };
    poster: SiteImage;
  };
  all: AlumniEvent[];
  leadEventId: string;
  storyEventIds: string[];
  gallery: Array<{ image: SiteImage; eventId: string; title: string; date: string; place: string }>;
}

export interface ChapterMeet {
  title: string;
  subtitle: string;
  date: string;
  place: string;
  /** What the evening consists of — "4 intellectual panels", and so on. */
  bill: string[];
  panels: Array<{ title: string; detail: string }>;
  note: string;
  names: string[];
}

export interface ChaptersSection {
  westZone: {
    eyebrow: string;
    headline: string[];
    city: string;
    lede: string;
    meet: ChapterMeet;
    poster: SiteImage;
    next: { label: string; title: string; date: string; href: string };
    source: { label: string; href: string };
    contact: { label: string; href: string };
  };
  page: {
    eyebrow: string;
    headline: string[];
    cue: string;
    posterCue: string;
    rail: Array<{ key: string; figure: string; label: string; value: string }>;
  };
  network: {
    eyebrow: string;
    title: string[];
    lede: string;
    caption: string;
    hint: string;
    nodes: Array<{
      key: string;
      x: number;
      y: number;
      city: string;
      role: string;
      detail: string;
      meta: string;
      anchor: string | null;
      action?: string;
      seat?: boolean;
    }>;
  };
  meetsSection: { eyebrow: string; title: string };
  billSection: { eyebrow: string; title: string };
  joinSection: { eyebrow: string; title: string; note: string };
  closing: { cta: NavLink };
}

/** One row of the "Explore the Xaverian network" accordion. */
export interface ExploreItem {
  id: string;
  title: string;
  description: string;
  href: string;
  image: SiteImage;
}

export interface ExploreSection {
  detailsLabel: string;
  items: ExploreItem[];
}

/** The enquiry form's labels and copy, shared by the contact page and the CTA band. */
export interface EnquiryForm {
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  consent: string;
  submit: string;
  sending: string;
  sent: string;
  error: string;
  /** The website's form action. The app posts to /api/app/v1/enquiry instead. */
  action: string;
}

export interface ContactSection {
  page: {
    title: string;
    intro: string;
    followLabel: string;
    socials: Array<{ name: string; href: string; icon: string }>;
    form: EnquiryForm;
    faqTitle: string;
  };
  faq: Array<{ question: string; answer: string }>;
  cta: {
    title: string;
    intro: string;
    form: EnquiryForm;
  };
}

export interface DirectorySection {
  copy: {
    title: string;
    intro: string;
    searchPlaceholder: string;
    clearLabel: string;
    emptyTitle: string;
    emptyBody: string;
    lockedNote: string;
    privacyNote: string;
  };
  filterLabels: { batchYear: string; stream: string };
}

export interface Content {
  site: SiteSection;
  nav: NavSection;
  home: HomeSection;
  about: AboutSection;
  events: EventsSection;
  chapters: ChaptersSection;
  explore: ExploreSection;
  contact: ContactSection;
  directory: DirectorySection;
  search: { page: { title: string; intro: string } };
  policies: { privacy: PolicyDocument; terms: PolicyDocument };
}

/** Privacy Policy / Terms of Use, from src/data/pages/policies.ts. */
export interface PolicyDocument {
  title: string;
  intro: string;
  /** The standing notice that this text is provisional. Shown verbatim. */
  notice: string;
  points: string[];
}

/** `GET /api/app/v1/config`. */
export interface AppConfig {
  minSupportedVersion: string;
  turnstile: { required: boolean; siteKey: string | null; embedUrl: string | null };
  features: { eventPhotos: boolean; notifications: boolean; connections: boolean };
}
