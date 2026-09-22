import type { SiteImage } from '@/lib/images';

/**
 * Nostalgia '26 cum Shakti — the content of the home page's opening run.
 *
 * Every field here is read off one of the two posters SXCCAA supplied and
 * nothing is inferred:
 *
 *   A. the invitation poster (purple/gold, supplied 6 September 2026) —
 *      `/images/events/nostalgia-26.jpg`. Carries the title, the date block,
 *      the lede, the star-studded line, the three-step booking ladder, the
 *      Reunite/Reconnect/Relive triptych and the bank block.
 *   B. the awardee poster (cream/gold, supplied 22 September 2026) —
 *      `/images/events/nostalgia-26-awardee.jpg`. Carries the awardee, the
 *      SHAKTI award block, the single ₹2,500 registration line, the
 *      "early bird ending soon" note, and the bank block again — this time
 *      with the IFSC code, which poster A does not print.
 *
 * Two things differ between the posters and are recorded as they were printed,
 * not reconciled:
 *
 *   - the account name. Poster A sets "AGRAWAL BUSINESS NETWORK LLP"; poster B
 *     sets "Agarwal Buisness Network LLP". The spellings of both the surname
 *     and the word "business" disagree, so `bank.name` follows poster B, the
 *     later of the two, and `bank.note` says what poster A prints. An account
 *     name is the one field a payer's bank may check — the Association should
 *     confirm which spelling is on the account.
 *   - the price. Poster A prints the full three-step ladder; poster B, issued
 *     after the first step's stated cut-off, prints ₹2,500 flat with "early
 *     bird ending soon". Both are kept: the ladder is the schedule, and
 *     `registration` is what the current poster asks for.
 *
 * The account number, IFSC and prices are set as text here — a reversal of the
 * earlier decision to leave them inside the artwork — because SXCCAA asked for
 * them on the page. They are printed on a poster the Association circulates
 * publicly, so nothing is being disclosed that was not already published; the
 * gain is that a donor on a phone can copy the account rather than transcribe
 * it from a picture, which is where a wrong digit comes from.
 */

/** The event itself, from the date block both posters carry. */
export const nostalgia = {
  id: 'nostalgia-26',
  /** Set in two lines on the artwork, and in two lines in the hero. */
  title: ['Nostalgia ’26', 'cum Shakti'],
  /** Plain-text form, for alt text, metadata and the lightbox caption. */
  titlePlain: 'Nostalgia ’26 cum Shakti',
  award: 'Women Achiever Awards 2026',
  association: 'St. Xavier’s College (Calcutta) Alumni Association',
  chapter: 'West Zone Chapter',
  invitation: 'Cordially invites you to',
  date: '3 October 2026',
  /** The same date, for the countdown. Nothing new is asserted. */
  iso: '2026-10-03',
  /** Split for the hero's date plate, exactly as the poster sets it. */
  stamp: { day: '3', ordinal: 'rd', month: 'October', year: '2026' },
  time: '10:00 AM – 5:00 PM',
  venue: 'Taj Santacruz',
  city: 'Mumbai',
  lede: 'A grand reunion celebrating bonds. Honouring women. Inspiring generations.',
  /** Poster B's tagline, under the title. */
  tagline: 'Reunite. Reconnect. Relive.',
  /** The line along the foot of poster B. */
  creed: 'Once a Xaverian, always a Xaverian',
  /** The two lines along the foot of poster A. */
  closing: { call: 'Come. Connect. Celebrate.', line: 'Memories that last a lifetime.' },
};

/** Poster A's star-studded callout, printed beside the three gold stars. */
export const billing = {
  headline: 'A star studded event',
  body: 'with very high profile awardees and keynote speakers',
};

/** The awardee named on poster B, and the SHAKTI block printed beside her. */
export const awardee = {
  eyebrow: 'Our awardee',
  name: 'Monali Thakur',
  /** The three words under the name, set as printed. */
  billing: 'Singer. Performer. Xaverian.',
  line: 'A voice that moves millions.',
  award: {
    name: 'Shakti',
    title: 'Women Achiever Awards 2026',
    line: 'Celebrating remarkable women.',
  },
};

/** Poster A's pull-quote, over the two photographs. */
export const invitationQuote = {
  lines: ['Let’s leave stress behind', 'and live one day with', 'family like friends', 'and laugh over life.'],
  /** Which of the lines above is set large on the artwork. */
  emphasis: 2,
};

/** The triptych along the foot of poster A. */
export const pillars = [
  { title: 'Reunite.', lines: ['Old friends.', 'New memories.'] },
  { title: 'Reconnect.', lines: ['Stronger bonds.', 'Timeless values.'] },
  { title: 'Relive.', lines: ['The glory.', 'The legacy.'] },
];

/** What poster B asks a reader to pay today. */
export const registration = {
  label: 'Registration',
  amount: '₹2,500',
  tax: '+ 18% GST',
  note: 'Early bird ending soon',
};

export interface PassTier {
  id: string;
  name: string;
  /** The qualifier under the name, split as the poster sets it. */
  qualifier: string[];
  amount: string;
  tax: string;
  /** The tier's stated cut-off, for ordering and for the "now" marker. */
  until: string;
}

/**
 * Poster A's booking ladder — "Early bird offers – book your seat today!".
 *
 * Each tier is capped by a booking count *or* a date, and only the Association
 * knows the count, so `until` is the date alone. The page uses it to mark which
 * step today falls in; it never claims a tier is sold out.
 */
export const passTiers: PassTier[] = [
  {
    id: 'early',
    name: 'Early bird',
    qualifier: ['First 30 bookings', 'or till 12th Sept 2026'],
    amount: '₹2500',
    tax: '+ 18% GST',
    until: '2026-09-12',
  },
  {
    id: 'after',
    name: 'After that',
    qualifier: ['Next 40 bookings', 'or till 25th Sept 2026'],
    amount: '₹2850',
    tax: '+ 18% GST',
    until: '2026-09-25',
  },
  {
    id: 'post',
    name: 'Post that',
    qualifier: ['Till 30th Sept 2026'],
    amount: '₹3000',
    tax: '+ 18% GST',
    until: '2026-09-30',
  },
];

export interface BankField {
  label: string;
  value: string;
  /** Copied to the clipboard as-is; unset where the label is not worth copying. */
  copy?: string;
}

/**
 * The bank block. Poster B prints all four lines; poster A prints the first
 * three. See the file header on the account-name spelling.
 */
export const bank = {
  heading: 'Bank details',
  note: 'Poster A sets the account name as “Agrawal Business Network LLP”. Please confirm the spelling with the Association before transferring.',
  fields: [
    { label: 'Account name', value: 'Agarwal Buisness Network LLP', copy: 'Agarwal Buisness Network LLP' },
    { label: 'Current A/C', value: '250014071997', copy: '250014071997' },
    { label: 'Bank', value: 'IndusInd Bank' },
    { label: 'IFSC code', value: 'INDB0000233', copy: 'INDB0000233' },
  ] as BankField[],
};

/** Poster A — the invitation. */
export const invitePoster: SiteImage = {
  src: '/images/events/nostalgia-26.jpg',
  width: 1024,
  height: 1536,
  /* The 512 cut is 341px across — narrower than the slot the poster occupies on
   * a desktop — so it is left out of the set. This is the page's centrepiece;
   * it should never be the candidate that gets upscaled. */
  widths: [1024],
  alt:
    'Invitation poster for Nostalgia ’26 cum Shakti, the Women Achiever Awards 2026, from the West Zone Chapter of the St. Xavier’s College (Calcutta) Alumni Association. 3rd October 2026, 10:00 AM to 5:00 PM, Taj Santacruz, Mumbai. The poster lists the early-bird booking rates and the bank details.',
};

/** Poster B — the awardee. */
export const awardeePoster: SiteImage = {
  src: '/images/events/nostalgia-26-awardee.jpg',
  width: 1131,
  height: 1391,
  widths: [512, 1024],
  alt:
    'Awardee poster for Nostalgia ’26: Monali Thakur — singer, performer, Xaverian — named alongside the Shakti Women Achiever Awards 2026. The poster repeats the date, venue, ₹2,500 registration and the bank details.',
};
