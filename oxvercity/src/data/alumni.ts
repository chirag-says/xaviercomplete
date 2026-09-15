/**
 * SYNTHETIC DATA — NOT REAL ALUMNI.
 *
 * The Association's spreadsheet is never shared with the people building this
 * site (plan §14), so development and tests run against the records below.
 * Every one is invented. The names are deliberately not names, the numbers are
 * in Ofcom's drama range (+44 7700 900xxx, reserved so it can never reach a
 * real handset), and the addresses are on example.org, which RFC 2606 reserves
 * for exactly this. Nothing here asserts anything about a real Xaverian.
 *
 * The shape matches `AlumniRecord` — the eleven Google Form columns as the
 * database holds them — so a component that renders these renders live rows
 * without a change. Confidential values sit here in plaintext because this file
 * is the stand-in for a decrypted row, which is what the loader hands over.
 *
 * Reached only when `USE_DEMO_ALUMNI=true`. src/lib/directory.ts refuses that
 * flag in production, so this file cannot be served by the real site.
 */

import type { AlumniRecord } from '@/lib/visibility';

/** Shown wherever a record is rendered, so a prototype is never mistaken for a record. */
export const DEMO_BADGE = 'Sample';

export const demoNotice =
  'These are sample records used to demonstrate the directory. The Association’s alumni data has not been loaded yet, so no profile below describes a real Xaverian.';

/**
 * Twelve records chosen to cover the access model rather than to look tidy.
 *
 * Between them they exercise every combination the gate has to get right: both
 * contact toggles, both Gmail toggles, both photo audiences, a record with no
 * number at all, a record with no login identity, and a rejected photograph.
 * A demo set where every row is complete tests nothing.
 */
export const demoAlumni: AlumniRecord[] = [
  {
    id: 'k3f9x2m7qp4w',
    fullName: 'Sample Profile 01',
    batchYear: 2018,
    stream: 'B.Com.',
    currentOrg: 'Sample Organisation',
    designation: 'Marketing Professional',
    previousRole: 'Marketing Associate, Sample Retail',
    contact: '+44 7700 900101',
    gmail: 'sample.profile.01@example.org',
    otherInfo: 'Interested in mentoring students working towards a career in brand marketing.',
    showContact: true,
    showGmail: true,
    photoAudience: 'public',
    photoStatus: 'none',
  },
  {
    id: 'b7n4t8v2yz6h',
    fullName: 'Sample Profile 02',
    batchYear: 2012,
    stream: 'B.Sc.',
    currentOrg: 'Sample Research Institute',
    designation: 'Research Scientist',
    previousRole: 'Doctoral researcher',
    contact: '+44 7700 900102',
    gmail: 'sample.profile.02@example.org',
    otherInfo: null,
    // Supplied a number, then thought better of publishing it. The commonest
    // real case, and the one the directory must handle without looking broken.
    showContact: false,
    showGmail: true,
    photoAudience: 'public',
    photoStatus: 'none',
  },
  {
    id: 'r5w9q3j7dk2m',
    fullName: 'Sample Profile 03',
    batchYear: 2005,
    stream: 'B.A.',
    currentOrg: 'Sample Public Body',
    designation: 'Policy Adviser',
    previousRole: null,
    // Wrote "NA" on the form. There is nothing to show and nothing to toggle.
    contact: null,
    gmail: 'sample.profile.03@example.org',
    otherInfo: null,
    showContact: false,
    showGmail: false,
    photoAudience: 'alumni',
    photoStatus: 'none',
  },
  {
    id: 'h2p6s4c8nx3v',
    fullName: 'Sample Profile 04',
    batchYear: 2021,
    stream: 'B.B.A.',
    currentOrg: 'Sample Technology',
    designation: 'Product Manager',
    previousRole: 'Associate Product Manager, Sample Technology',
    contact: '+44 7700 900104',
    gmail: 'sample.profile.04@example.org',
    otherInfo: 'Happy to talk to anyone considering a move into product from another discipline.',
    showContact: true,
    showGmail: true,
    photoAudience: 'public',
    photoStatus: 'none',
  },
  {
    id: 'm8z3g7k2ft5q',
    fullName: 'Sample Profile 05',
    batchYear: 1998,
    stream: 'B.A.',
    currentOrg: 'Sample Publishing',
    designation: 'Editor',
    previousRole: 'Sub-editor, Sample Daily',
    contact: '+44 7700 900105',
    gmail: 'sample.profile.05@example.org',
    otherInfo: null,
    showContact: true,
    showGmail: false,
    photoAudience: 'alumni',
    photoStatus: 'none',
  },
  {
    id: 'd4v7b9n3xw6r',
    fullName: 'Sample Profile 06',
    batchYear: 2016,
    stream: 'B.Sc.',
    currentOrg: 'Sample Software',
    designation: 'Software Engineer',
    previousRole: 'Graduate Engineer, Sample Software',
    contact: null,
    gmail: 'sample.profile.06@example.org',
    otherInfo: 'Open-source contributor; interested in distributed systems.',
    showContact: false,
    showGmail: true,
    photoAudience: 'public',
    photoStatus: 'none',
  },
  {
    id: 'q9j2m5t8hz4c',
    fullName: 'Sample Profile 07',
    batchYear: 2009,
    stream: 'B.Com.',
    currentOrg: 'Sample Advisory',
    designation: 'Chartered Accountant',
    previousRole: null,
    contact: '+44 7700 900107',
    gmail: 'sample.profile.07@example.org',
    otherInfo: null,
    showContact: false,
    showGmail: false,
    photoAudience: 'alumni',
    photoStatus: 'none',
  },
  {
    id: 'w6k4r7p2vn9s',
    fullName: 'Sample Profile 08',
    batchYear: 2023,
    stream: 'B.A.',
    currentOrg: 'Freelance',
    designation: 'Documentary Producer',
    previousRole: 'Production Assistant, Sample Films',
    contact: '+44 7700 900108',
    gmail: 'sample.profile.08@example.org',
    otherInfo: 'Self-employed since 2024.',
    showContact: true,
    showGmail: true,
    photoAudience: 'public',
    // An administrator took this one down; the object was deleted and the card
    // fell back to the avatar. Exercises the "no object behind it" branch.
    photoStatus: 'removed',
  },
  {
    id: 'z3t8n5x2qm7f',
    fullName: 'Sample Profile 09',
    batchYear: 2001,
    stream: 'B.Sc.',
    currentOrg: 'Sample Health',
    designation: 'Clinical Researcher',
    previousRole: null,
    contact: '+44 7700 900109',
    gmail: 'sample.profile.09@example.org',
    otherInfo: null,
    showContact: true,
    showGmail: true,
    photoAudience: 'alumni',
    photoStatus: 'none',
  },
  {
    id: 'c7h3v9k4sw2p',
    fullName: 'Sample Profile 10',
    batchYear: 2014,
    stream: 'B.A.',
    currentOrg: 'Sample Foundation',
    designation: 'Development Consultant',
    previousRole: 'Programme Officer, Sample Foundation',
    contact: null,
    gmail: 'sample.profile.10@example.org',
    otherInfo: 'Works across South and South-East Asia.',
    showContact: false,
    showGmail: true,
    photoAudience: 'public',
    photoStatus: 'none',
  },
  {
    id: 'n5q2w8f3jt6k',
    fullName: 'Sample Profile 11',
    batchYear: 2019,
    stream: 'B.Sc.',
    currentOrg: 'Sample Bank',
    designation: 'Data Analyst',
    previousRole: null,
    contact: '+44 7700 900111',
    gmail: 'sample.profile.11@example.org',
    otherInfo: null,
    showContact: true,
    showGmail: true,
    photoAudience: 'public',
    photoStatus: 'none',
  },
  {
    id: 'v4m7c2z9pk3h',
    fullName: 'Sample Profile 12',
    batchYear: 1993,
    stream: 'B.A.',
    currentOrg: 'Sample School',
    designation: 'Principal',
    previousRole: 'Head of Department, Sample School',
    contact: null,
    // No Gmail on the form, so no login identity. In the directory, but cannot
    // sign in — a real and common row shape (plan §4.2, "rows without login").
    gmail: null,
    otherInfo: null,
    showContact: false,
    showGmail: false,
    photoAudience: 'public',
    photoStatus: 'none',
  },
];

/** The three profiles the "Featured Xaverians" band shows. */
export const featuredIds = ['h2p6s4c8nx3v', 'b7n4t8v2yz6h', 'c7h3v9k4sw2p'];

export const directoryCopy = {
  title: 'Meet the Xaverian community',
  intro: 'Explore the journeys, professions and experiences of Xaverians across generations.',
  searchPlaceholder: 'Search by name, organisation, designation or stream...',
  clearLabel: 'Clear filters',
  emptyTitle: 'No Xaverians match that search',
  emptyBody: 'Try a different spelling, or clear a filter or two and search again.',
  /** Shown to a signed-out visitor, where the hover overlay would otherwise be. */
  lockedNote: 'Sign in with the email the Association holds for you to open full profiles.',
  /** Shown on a full profile, so nobody has to guess who else can read it. */
  privacyNote:
    'Contact details on this page are visible only to signed-in Xaverians, and only where the alumnus has chosen to share them. They are never shown on the public directory.',
};

export const filterLabels = {
  batchYear: 'Batch year',
  stream: 'Stream',
} as const;

export type FilterKey = keyof typeof filterLabels;
