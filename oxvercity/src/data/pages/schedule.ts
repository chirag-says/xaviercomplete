import type { SiteImage } from '@/lib/images';

/**
 * The day's programme, read off the Nostalgia '26 schedule poster.
 *
 * Every field — time, title, speaker names, designations — is transcribed
 * verbatim from the poster. Nothing has been paraphrased or inferred.
 */

export interface ScheduleEvent {
  time: string;
  title: string;
  /** Speaker / guest name, if any. Bold on the poster. */
  speaker?: string;
  /** Designation / detail that follows the speaker name. */
  detail?: string;
  /** If true, rendered as a special block (SHAKTI SAMMAN). */
  highlight?: boolean;
}

export const schedule: ScheduleEvent[] = [
  {
    time: '9.15',
    title: 'Registration & Meet and Greet (Tea, Coffee and Vadapav awaits)',
  },
  {
    time: '10.30',
    title: 'Lighting of the Lamp followed by the National Anthem',
  },
  {
    time: '10.40',
    title: 'Address by Rev.',
    speaker: 'Dr. Dominic Savio',
    detail: 'SJ Principal SXC, President SXCCAA',
  },
  {
    time: '10.45',
    title: 'Welcome Message by',
    speaker: 'Mr. Firdasul Hasan',
    detail: 'Ex Secretary SXCCAA',
  },
  {
    time: '10.55',
    title: 'Welcome Message by',
    speaker: 'Dr. Sanjay Goel',
    detail: 'Secretary SXCCAA (West Zone Chapter)',
  },
  {
    time: '11.05',
    title: 'Special Address by Chief Guest',
    speaker: 'Mr. Amit Harlalka',
    detail: 'CEO - ArcelorMittal Nippon Steel India.',
  },
  {
    time: '11.15',
    title: 'Felicitation of',
    speaker: 'Ms. Aswati Dorje',
    detail: 'IPS ADGP - Prevention of Crime Against Women & Children',
  },
  {
    time: '11.35',
    title: 'Keynote Address by Xaverian',
    speaker: 'Mr. Robin Banerjee',
    detail: 'Chairman Nucleon Research Pvt Ltd',
  },
  {
    time: '12.05',
    title: 'Fireside Chat with',
    speaker: 'Mr. Pankaj Tibrewal',
    detail: '(Founder & CIO IKIGAI Asset Manager || Ex-Kotak MF) with Mr. Saurav Gupta, Deputy Editor with NDTV',
  },
  {
    time: '12.45',
    title: 'Keynote Address and Felicitation of',
    speaker: 'Ms. Priti Rathi Gupta',
    detail: 'Founder Lxme, Ex Managing Director @ Anand Rathi',
  },
  {
    time: '13.15',
    title: 'Gala Lunch and Fellowship',
  },
  {
    time: '14.15',
    title: 'SHAKTI SAMMAN',
    detail: 'Felicitation of Awardees & Brief Address by them',
    highlight: true,
  },
  {
    time: '16.15',
    title: 'Vote of Thanks by',
    speaker: 'CA. Parimal Sheth',
  },
  {
    time: '16.25',
    title: 'Sumptuous High Tea and Fellowship',
  },
];

export const specialInvitee = {
  label: 'Special Invitee',
  name: 'Ms Ananya Birla',
  detail: 'Director at Aditya Birla Group, Founder & Chairperson, Svatantra Microfin',
};

/** The schedule poster itself, displayed on the page. */
export const schedulePoster: SiteImage = {
  src: '/images/events/nostalgia-26-schedule.png',
  width: 1031,
  height: 1526,
  widths: [],
  alt:
    'Nostalgia \'26 program schedule poster — St. Xavier\'s College (Calcutta) Alumni Association, West Zone Chapter. Saturday, 3rd October 2026 at Taj Santacruz, Mumbai. Lists the full day\'s programme from 9.15 AM to 4.25 PM including keynote addresses, felicitations, the Shakti Samman ceremony, and fellowship meals.',
};
