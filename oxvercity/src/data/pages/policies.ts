/**
 * The Privacy Policy and Terms of Use copy.
 *
 * Both documents are the Association's to write (SOW §9.4). Until SXCCAA
 * supplies the wording, each page states what the platform is built to do and
 * says plainly that this is not the Association's legal text.
 *
 * ## Why this is a data module rather than sitting in the page
 *
 * It was inline in the two page components until the mobile app needed it. The
 * app reproduces the website's content exactly, and it gets that content from
 * `/api/app/v1/content` — so any copy that lives only inside a React component
 * is copy the app cannot show without a second, hand-maintained duplicate that
 * drifts the first time one side is edited.
 *
 * Moving it here gives both surfaces one source. The pages render identically;
 * `npm run harden:verify` and the page tests are what prove that.
 *
 * When the real documents arrive they replace the arrays below, and both the
 * website and every installed app pick them up — the app with no release, since
 * it re-fetches the bundle on launch.
 */

export interface PolicyDocument {
  title: string;
  intro: string;
  /** The standing notice that this is provisional. */
  notice: string;
  points: string[];
}

export const privacyPolicy: PolicyDocument = {
  title: 'Privacy Policy',
  intro:
    "The Association's privacy policy will be published here. Until SXCCAA supplies the wording, this page records how the platform is built to treat personal data.",
  notice:
    'Awaiting content from SXCCAA. The points below describe the platform’s behaviour; they are not the Association’s legal wording.',
  points: [
    'No alumnus’s email address, phone number, postal address, date of birth or roll number is shown anywhere on the public site.',
    'A connection request reaches an alumnus only after the Association has reviewed it, and contact details are released only if the alumnus accepts.',
    'Every alumni record carries visibility and consent flags. A record can be withdrawn from the public directory at any time.',
    'Alumni profile pages are excluded from search-engine indexing by default.',
    'All alumni data remains the property of SXCCAA.',
  ],
};

export const termsOfUse: PolicyDocument = {
  title: 'Terms of Use',
  intro:
    "The Association's terms of use will be published here. Until SXCCAA supplies the wording, this page records the terms the platform is built to enforce.",
  notice:
    'Awaiting content from SXCCAA. The points below describe the platform’s behaviour; they are not the Association’s legal wording.',
  points: [
    'The directory is for the Xaverian community. It may not be scraped, copied or used to build a mailing list.',
    'Connection requests are for genuine contact — mentorship, career guidance, referrals or research. Requests are rate-limited and moderated.',
    'Misuse of the connection-request feature can result in a requester being blocked by the Association.',
    'The Association may correct, archive or remove any record in the directory.',
  ],
};
