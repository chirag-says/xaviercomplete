/**
 * Site-wide content: the brand, contact details and the link lists that the
 * header and footer render. Edit here; the components only lay it out.
 *
 * Facts about the College come from the official site, sxccal.edu. Nothing
 * about the alumni body itself is stated as a number here, because the
 * Association has not supplied the alumni dataset yet.
 */

export const siteLogo = {
  /** Crest and wordmark in white, used over the dark hero images and in the preloader. */
  white: '/svg/logo-white.svg',
  /** The ink cut, used in the footer lockup. */
  dark: '/svg/logo-dark.svg',
  /** The oversized mark behind the footer, drawn at roughly 1245×227. */
  watermark: '/svg/logo-watermark.svg',
  width: 156,
  height: 38,
  /**
   * The crest on its own, with no wordmark. The header carries this rather than
   * the full lockup: the College name is already the page's first heading, and
   * the mark reads better large. Full colour, so it needs no light/ink cut.
   */
  crest: '/svg/logo-crest.svg',
  crestWidth: 134,
  crestHeight: 160,
};

/** The institution. */
export const siteName = "St. Xaviers College (Calcutta)";
/** The Association this site belongs to. */
export const associationName = "St. Xaviers College (Calcutta) Alumni Association";
export const associationShortName = 'SXCCAA';
/** The College motto, used as a quiet sign-off. */
export const motto = 'Nihil Ultra';

export const contact = {
  officeLabel: 'Association Office',
  /** Rendered one line each (an empty string is a blank line), as the original's forced line breaks. */
  address: ['30, Mother Teresa Sarani', '', 'Kolkata – 700016, West Bengal, India'],
  addressHref:
    "https://www.google.com/maps/search/?api=1&query=St+Xavier's+College+Autonomous+Kolkata%2C+30%2C+Mother+Teresa+Sarani%2C+Kolkata+700016",
  emailLabel: 'Email',
  email: 'contact@sxccal.edu',
  /** College reception, as published on sxccal.edu. */
  phone: '033-2255-1101',
  phoneHref: 'tel:+913322551101',
};

export interface NavLink {
  label: string;
  href: string;
}

/**
 * The pills in the desktop bar, in reading order. The "Explore" dropdown is
 * rendered between the second and third, so the bar reads
 * Home · About SXCCAA · Explore · Chapters · Events · Contact.
 */
export const mainNav: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'About SXCCAA', href: '/about' },
  { label: 'Chapters', href: '/chapters' },
  { label: 'Events', href: '/events' },
  { label: 'Contact', href: '/contact' },
];

/** Label on the desktop dropdown pill. */
export const pagesMenuLabel = 'Explore';

/** The dropdown in the desktop header, three columns. */
export const pagesMenu: { title: string; links: NavLink[] }[] = [
  {
    title: 'Alumni',
    links: [
      { label: 'Alumni Directory', href: '/alumni' },
      { label: 'Xaverians Making a Difference', href: '/alumni#featured' },
      { label: 'Connect with an Alumnus', href: '/alumni' },
    ],
  },
  {
    title: 'Association',
    links: [
      { label: 'About SXCCAA', href: '/about' },
      { label: 'Chapters', href: '/chapters' },
      { label: 'Alumni Events & Activities', href: '/events' },
      { label: 'Contact SXCCAA', href: '/contact' },
    ],
  },
  {
    title: 'More',
    links: [
      { label: 'Search', href: '/search' },
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms of Use', href: '/terms-of-use' },
    ],
  },
];

/** The phone and tablet menu, one flat list. */
export const mobileMenu: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'About SXCCAA', href: '/about' },
  { label: 'Alumni Directory', href: '/alumni' },
  { label: 'Xaverians Making a Difference', href: '/alumni#featured' },
  { label: 'Explore the Network', href: '/explore' },
  { label: 'Chapters', href: '/chapters' },
  { label: 'Alumni Events & Activities', href: '/events' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Use', href: '/terms-of-use' },
];

export const headerCta: NavLink = { label: 'Explore Alumni', href: '/alumni' };

/**
 * The way from the home page to the events page. The home page has no events
 * section of its own — alumni events and activities have a page — so this pill
 * appears twice: beside "Explore Alumni" in the About section near the top,
 * and beside "Explore the Network" in the network section further down.
 */
export const eventsCta: NavLink = { label: 'Events & Activities', href: '/events' };

/** The enquiry block at the foot of the home and about pages. */
export const contactCta = {
  title: 'Stay connected with SXCCAA',
  intro: 'Have a question, or want to reconnect with the Xaverian community? Get in touch with us.',
  form: {
    nameLabel: 'Full name*',
    namePlaceholder: 'Your full name',
    emailLabel: 'Email*',
    emailPlaceholder: 'you@example.com',
    messageLabel: 'Message',
    messagePlaceholder: 'Tell us how we can help...',
    consent: 'I agree to the SXCCAA privacy policy and terms of use.',
    submit: 'Send Message',
    sending: 'Sending…',
    sent: 'Message sent',
    error: 'Could not send, try again',
    /**
     * Where the enquiry goes. Required: an unset action used to report success
     * and throw the message away — see the header of SiteForm.tsx.
     */
    action: '/api/enquiry',
  },
};

export const footerColumns: { title: string; links: NavLink[] }[] = [
  {
    title: 'Main Pages',
    links: [
      { label: 'Home', href: '/' },
      { label: 'About SXCCAA', href: '/about' },
      { label: 'Alumni', href: '/alumni' },
      { label: 'Chapters', href: '/chapters' },
      { label: 'Events & Activities', href: '/events' },
      { label: 'Stories', href: '/alumni#featured' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { label: 'Alumni Directory', href: '/alumni' },
      { label: 'Connect', href: '/explore#connect' },
    ],
  },
  {
    title: 'Support',
    links: [{ label: 'Contact SXCCAA', href: '/contact' }],
  },
  {
    title: 'Utility Pages',
    links: [
      { label: 'Search', href: '/search' },
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms of Use', href: '/terms-of-use' },
    ],
  },
];
