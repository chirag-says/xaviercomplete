/**
 * Mail the portal sends.
 *
 * Same rules as the public app's templates, plus one more that matters here:
 *
 * - **No PII beyond the recipient's own address.** Never another alumnus's
 *   name, never a batch, never a contact detail.
 * - **Nothing that confirms membership to a bystander.**
 * - **Plain text alongside HTML.**
 * - **An admin notification never contains the thing being notified about.**
 *   "One new access request" — not who, not why. The admin signs in to see it.
 *   A mailbox is the least controlled place this data could sit, and an
 *   Association mailbox is often shared.
 */

import { mailConfig, send, MailConfigError, type Mail, type MailConfig } from './shared.ts';

export { mailConfig, send, MailConfigError };
export type { Mail, MailConfig };

/**
 * The portal's own origin, for links in admin mail.
 *
 * Separate from APP_URL — a link to the portal must point at
 * admin.sxccaa.org, and getting this wrong would send an admin's invitation
 * token to the public site.
 */
export function adminUrl(): string {
  const url = process.env.ADMIN_URL;
  if (!url) throw new Error('ADMIN_URL is not set (e.g. "https://admin.sxccaa.org").');
  return url.replace(/\/$/, '');
}

const WRAP = (body: string, footer: string) => `<!doctype html>
<html lang="en"><body style="margin:0;padding:32px 16px;background:#f6f5f3;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:36px 32px">
<p style="margin:0 0 24px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8a">SXCCAA — Admin portal</p>
${body}
<hr style="border:0;border-top:1px solid #eae8e4;margin:32px 0 20px">
<p style="margin:0;font-size:13px;color:#8a8a8a">${footer}</p>
</div></body></html>`;

const BUTTON = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 30px;border-radius:50px;font-weight:500">${label}</a>`;

/** An invitation to become an admin. Carries the one-use token in the link. */
export function adminInviteEmail(link: string, hours: number): Omit<Mail, 'to'> {
  const text = [
    'You have been invited to administer the SXCCAA alumni directory',
    '',
    `Open the link below within ${hours} hours to set a password and enrol two-factor authentication. It works once.`,
    '',
    link,
    '',
    'You will need an authenticator app on your phone — 1Password, Aegis, Google Authenticator or similar. Two-factor is required; the account cannot be used without it.',
    '',
    'If you were not expecting this, ignore it and tell the Association. Nothing is created until the link is opened and the enrolment completed.',
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">You have been invited to administer the directory</h1>
     <p style="margin:0 0 8px;color:#4a4a4a">Set a password and enrol two-factor authentication. The link works once and expires in ${hours} hours.</p>
     <p style="margin:0 0 28px;color:#4a4a4a">Have an authenticator app to hand — 1Password, Aegis, Google Authenticator or similar. It is required, not optional.</p>
     ${BUTTON(link, 'Complete setup')}
     <p style="margin:28px 0 0;font-size:13px;color:#8a8a8a;word-break:break-all">Or paste this into your browser:<br>${link}</p>`,
    'If you were not expecting this, ignore it and tell the Association. Nothing is created until the enrolment is completed.',
  );

  return { subject: 'Invitation to administer the SXCCAA alumni directory', text, html };
}

/**
 * Told to the Association mailbox when something needs attention.
 *
 * Deliberately contentless. `count` is a number, and the subject says what kind
 * of thing — nothing else.
 */
export function adminNotificationEmail(what: 'access_request' | 'photo_review', count: number): Omit<Mail, 'to'> {
  const noun = what === 'access_request' ? 'access request' : 'photograph awaiting review';
  const plural = count === 1 ? noun : `${noun}s`;
  const link = `${adminUrl()}/`;

  const text = [
    `${count} ${plural} in the SXCCAA admin portal`,
    '',
    'Sign in to review. This message deliberately contains no details — they are in the portal.',
    '',
    link,
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">${count} ${plural}</h1>
     <p style="margin:0 0 28px;color:#4a4a4a">Sign in to review. This message deliberately carries no details.</p>
     ${BUTTON(link, 'Open the portal')}`,
    'You are receiving this because you administer the SXCCAA alumni directory.',
  );

  return { subject: `SXCCAA: ${count} ${plural}`, text, html };
}

/** Access granted — the requester can now sign in to the directory. */
export function accessGrantedEmail(signInUrl: string, profileUrl: string): Omit<Mail, 'to'> {
  const text = [
    'Your access to the SXCCAA alumni directory has been approved',
    '',
    'Sign in with this address — there is no password. We email you a six-digit code each time.',
    '',
    signInUrl,
    '',
    'Once you are in, visit your own profile to choose what other Xaverians can see:',
    '  - your photograph, and whether it is public or for signed-in alumni only',
    '  - whether your contact number is shown to signed-in alumni',
    '  - whether your email address is shown to signed-in alumni',
    '',
    profileUrl,
    '',
    'You can change any of these at any time, or remove yourself from the directory entirely.',
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Your directory access is approved</h1>
     <p style="margin:0 0 28px;color:#4a4a4a">Sign in with this address. There is no password — we email you a six-digit code each time.</p>
     ${BUTTON(signInUrl, 'Sign in')}
     <p style="margin:28px 0 8px;color:#4a4a4a">Once you are in, open your own profile to choose what other Xaverians can see:</p>
     <ul style="margin:0 0 20px;padding-left:20px;color:#4a4a4a">
       <li>your photograph, and whether it is public or alumni-only</li>
       <li>whether your contact number is shown to signed-in alumni</li>
       <li>whether your email address is shown to signed-in alumni</li>
     </ul>
     <p style="margin:0;font-size:13px;color:#8a8a8a;word-break:break-all">${profileUrl}</p>`,
    'You can change these at any time, or remove yourself from the directory entirely.',
  );

  return { subject: 'Your SXCCAA alumni directory access', text, html };
}

/**
 * Access refused.
 *
 * No reason, no admin named (decision 4, 10 Sep 2026). It does not invite an
 * argument and does not put the Association's reasoning in writing.
 */
export function accessRejectedEmail(): Omit<Mail, 'to'> {
  const text = [
    'About your request for SXCCAA alumni directory access',
    '',
    'Your request could not be approved at this time.',
    '',
    'If you believe this is a mistake, you are welcome to apply again after 30 days.',
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">About your request</h1>
     <p style="margin:0 0 12px;color:#4a4a4a">Your request for alumni directory access could not be approved at this time.</p>
     <p style="margin:0;color:#4a4a4a">If you believe this is a mistake, you are welcome to apply again after 30 days.</p>`,
    'St Xavier\'s College (Calcutta) Alumni Association',
  );

  return { subject: 'Your SXCCAA alumni directory request', text, html };
}

// --- broadcasts --------------------------------------------------------------

/**
 * Escape text for an HTML email body.
 *
 * The broadcast subject and body are the only author-supplied content this file
 * interpolates into HTML, and unlike the rest of the site there is no React
 * here to do it for us — these templates are plain strings. An admin is trusted
 * and this is still not optional: a stray `<` in "Class of <2015" would silently
 * eat the rest of the paragraph in every recipient's mail client.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Blank-line-separated text becomes paragraphs. No other markup is honoured. */
function paragraphs(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;color:#4a4a4a">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
}

export interface BroadcastContent {
  subject: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  /** Absolute URL of the poster, for the inline image. Null when there is none. */
  posterUrl: string | null;
  unsubscribeUrl: string;
}

/**
 * An announcement or event invitation to one alumnus.
 *
 * ## Why the poster is both shown and attached
 *
 * Most mail clients block remote images until the reader asks for them, so an
 * inline `<img>` alone means a good share of recipients see an empty rectangle
 * where the poster should be. An attachment always arrives. Doing both means
 * the message looks right for people who load images and still carries the
 * poster for everyone else — and the attachment is what someone forwards to a
 * friend or opens on a phone with no signal.
 *
 * ## What this message does not contain
 *
 * Nothing about any other alumnus, and no recipient list — each message is
 * addressed to one person and sent on its own. It also carries no sign-in link
 * and no code: a mailing that goes to five hundred people is exactly the shape
 * an attacker would forge, and the less it teaches people to click, the better.
 *
 * The unsubscribe line is in the footer of every one of these, without
 * exception. It is a legal obligation under the DPDP Act and, more immediately,
 * it is what stops recipients using their mail client's "mark as spam" button
 * as the unsubscribe button — which would cost the Association its ability to
 * deliver anything to anyone.
 */
export function broadcastEmail(content: BroadcastContent): Omit<Mail, 'to'> {
  const { subject, body, linkUrl, linkLabel, posterUrl, unsubscribeUrl } = content;
  const label = linkLabel?.trim() || 'More information';

  const text = [
    subject,
    '',
    body.trim(),
    ...(linkUrl ? ['', `${label}: ${linkUrl}`] : []),
    ...(posterUrl ? ['', 'The poster is attached to this email.'] : []),
    '',
    '—',
    'St Xavier\'s College (Calcutta) Alumni Association',
    '',
    'To stop receiving these emails, open:',
    unsubscribeUrl,
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 20px;font-size:22px;font-weight:600">${escapeHtml(subject)}</h1>
     ${paragraphs(body)}
     ${
       posterUrl
         ? `<p style="margin:24px 0 0"><img src="${posterUrl}" alt="${escapeHtml(subject)}" width="100%" style="display:block;width:100%;max-width:456px;height:auto;border-radius:10px"></p>
            <p style="margin:10px 0 0;font-size:13px;color:#8a8a8a">The poster is also attached to this email.</p>`
         : ''
     }
     ${linkUrl ? `<p style="margin:28px 0 0">${BUTTON(linkUrl, escapeHtml(label))}</p>` : ''}`,
    `You are receiving this because you are listed in the SXCCAA alumni directory. <a href="${unsubscribeUrl}" style="color:#8a8a8a">Unsubscribe</a> — this only stops the email and leaves your directory profile untouched.`,
  );

  return { subject, text, html };
}
