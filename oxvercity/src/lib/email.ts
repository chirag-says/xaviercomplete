/**
 * Sending mail, through Resend.
 *
 * A direct `fetch` rather than the `resend` SDK: this is one POST to one
 * endpoint, and a dependency that wraps fifteen lines is a dependency whose
 * transitive tree we now own. The SDK earns its place when we need batching,
 * attachments or webhooks; none of that is in this plan.
 *
 * ## Rules these templates follow
 *
 * - **No PII beyond the recipient's own address.** Not their name, not their
 *   batch, nothing about anyone else. A mailbox is not a place to put a
 *   directory, and an email sitting in a breached inbox should reveal nothing
 *   about the Association's members.
 * - **Nothing that confirms membership to a bystander.** We only ever email an
 *   address already on the allowlist, so the mere arrival is a signal — but the
 *   content adds nothing to it.
 * - **Plain text alongside HTML.** Some alumni read mail in clients that will
 *   not render the HTML, and a sign-in link that does not appear is a support
 *   request.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export class MailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MailConfigError';
  }
}

export interface MailConfig {
  apiKey: string;
  from: string;
  replyTo?: string;
  /** Public origin used to build links. Swapping domains is this one value. */
  appUrl: string;
}

export function mailConfig(): MailConfig {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  const appUrl = process.env.APP_URL;

  if (!apiKey) throw new MailConfigError('RESEND_API_KEY is not set.');
  if (!from) throw new MailConfigError('MAIL_FROM is not set (e.g. "SXCCAA Alumni <alumni@example.org>").');
  if (!appUrl) throw new MailConfigError('APP_URL is not set (e.g. "https://sxccaa.org").');

  return { apiKey, from, replyTo: process.env.MAIL_REPLY_TO, appUrl: appUrl.replace(/\/$/, '') };
}

/**
 * A file travelling with a message.
 *
 * Only the event poster uses this. `content` is the raw bytes; the base64 the
 * provider wants is done at the last moment in {@link send}, so nothing above
 * this layer handles an encoded blob it could accidentally log.
 */
export interface Attachment {
  filename: string;
  content: Buffer;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  /**
   * Overrides `MailConfig.replyTo` for this one message.
   *
   * Used by the enquiry form so the Association can simply hit reply. The value
   * is whatever the sender typed into a public form, so it is validated before
   * it gets here and the message body says plainly that it is unverified.
   * Injection is not a concern — this goes to Resend as JSON, not as SMTP
   * headers — but impersonation is, and no amount of escaping fixes that.
   */
  replyTo?: string;
  /**
   * Files to attach. Kept small on purpose — see `MAX_ATTACHMENT_BYTES`.
   */
  attachments?: Attachment[];
}

/**
 * The ceiling on one message's attachments.
 *
 * Not a provider limit — Resend accepts considerably more. It is a limit on
 * what is sensible to send five hundred times: every megabyte here is a
 * megabyte uploaded per recipient, and a large attachment is a deliverability
 * problem as much as a bandwidth one. The poster is re-encoded well under this
 * before it ever reaches here; the check exists so that a future caller who
 * skips that step fails immediately rather than at recipient two hundred.
 */
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/**
 * Send one message.
 *
 * Throws on failure so the caller decides what the user sees — which for the
 * login route is nothing, because revealing that sending failed would also
 * reveal that the address was on the allowlist.
 */
export async function send(mail: Mail, config: MailConfig = mailConfig()): Promise<{ id: string }> {
  const attachments = mail.attachments ?? [];
  const attachedBytes = attachments.reduce((total, file) => total + file.content.byteLength, 0);
  if (attachedBytes > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `Attachments total ${Math.round(attachedBytes / 1024)} KB, over the ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB ceiling.`,
    );
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.from,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(mail.replyTo ?? config.replyTo ? { reply_to: mail.replyTo ?? config.replyTo } : {}),
      ...(attachments.length > 0
        ? { attachments: attachments.map((file) => ({ filename: file.filename, content: file.content.toString('base64') })) }
        : {}),
    }),
    // Longer than the default when carrying a file: the request body is now
    // megabytes rather than kilobytes, and a timeout here is recorded as a
    // failed recipient that the next chunk would retry.
    signal: AbortSignal.timeout(attachments.length > 0 ? 30_000 : 10_000),
  });

  if (!response.ok) {
    // The body can echo the recipient address, so it is read for the status
    // code's sake and deliberately not included in the thrown message.
    await response.text().catch(() => '');
    throw new Error(`Resend rejected the message with status ${response.status}.`);
  }

  const body = (await response.json()) as { id?: string };
  return { id: body.id ?? 'unknown' };
}

// --- templates ---------------------------------------------------------------

const WRAP = (body: string, footer: string) => `<!doctype html>
<html lang="en"><body style="margin:0;padding:32px 16px;background:#f6f5f3;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;padding:36px 32px">
<p style="margin:0 0 24px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#8a8a8a">St Xavier's College Calcutta Alumni Association</p>
${body}
<hr style="border:0;border-top:1px solid #eae8e4;margin:32px 0 20px">
<p style="margin:0;font-size:13px;color:#8a8a8a">${footer}</p>
</div></body></html>`;

/** The one call to action a message is allowed. Inline styles, because mail clients strip stylesheets. */
const BUTTON = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:14px 30px;border-radius:50px;font-weight:500">${label}</a>`;

/**
 * The sign-in code.
 *
 * The code is the whole message, so it is large, selectable and repeated in the
 * plain-text part for the clients that will not render HTML. Everything else is
 * short: a code email that needs reading is a code email people mistype.
 *
 * There is deliberately **no link back to the sign-in page**. This message goes
 * to an address on the allowlist, which makes it a valuable thing to forge, and
 * "here is a code, now click here to enter it" is the exact shape of a phishing
 * mail. The recipient is already on the page they asked for the code from, so
 * the link would save nobody anything and would teach five hundred people that
 * a message like this is normal.
 *
 * The subject line leads with the code so it can be read from a notification
 * without opening the mailbox at all.
 */
export function signInOtpEmail(code: string, minutes: number): Omit<Mail, 'to'> {
  const text = [
    `Your sign-in code is ${code}`,
    '',
    `Type it into the page you asked for it from. It expires in ${minutes} minutes and works once.`,
    '',
    'If you did not ask to sign in, ignore this message. The code is useless on its own, nothing happens without it, and nobody is told you received it.',
    '',
    'The Association will never ask you for a password, never asks for this code by phone or email, and never asks for money by email.',
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Your sign-in code</h1>
     <p style="margin:0 0 20px;color:#4a4a4a">Type this into the page you asked for it from. It expires in ${minutes} minutes and works once.</p>
     <p style="margin:0 0 24px;font:600 34px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;color:#1a1a1a">${code}</p>
     <p style="margin:0;color:#4a4a4a">If you did not ask to sign in, ignore this message. The code does nothing on its own.</p>`,
    'The Association will never ask you for a password, never asks for this code by phone or email, and never asks for money by email.',
  );

  return { subject: `${code} is your SXCCAA sign-in code`, text, html };
}

/**
 * The one-time code for a directory access request.
 *
 * The code is the whole point of the message, so it is large, selectable and
 * repeated in the plain-text part. Everything else is short: a code email that
 * needs reading is a code email people mistype.
 *
 * `alreadyHasAccess` is the one thing this message may say that the form's
 * response may not. The response has to be identical for every address or it
 * becomes a way to test who is a Xaverian; this email only ever reaches the
 * address in question, so telling its owner they can already sign in reveals
 * nothing and saves them waiting on an admin who has nothing to approve.
 */
export function accessRequestOtpEmail(
  code: string,
  minutes: number,
  alreadyHasAccess: boolean,
  signInUrl: string,
): Omit<Mail, 'to'> {
  const already = alreadyHasAccess
    ? [
        '',
        'One thing worth knowing: this address already has access to the directory.',
        'You can sign in right now without waiting for anyone — there is no password,',
        'we email you a code each time:',
        '',
        signInUrl,
      ]
    : [];

  const text = [
    `Your code is ${code}`,
    '',
    `Type it into the page you came from. It expires in ${minutes} minutes and works once.`,
    ...already,
    '',
    'If you did not ask for directory access, ignore this message. Nothing happens without the code, and nobody is told you received it.',
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Your verification code</h1>
     <p style="margin:0 0 20px;color:#4a4a4a">Type this into the page you came from. It expires in ${minutes} minutes.</p>
     <p style="margin:0 0 24px;font:600 34px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;color:#1a1a1a">${code}</p>
     ${
       alreadyHasAccess
         ? `<p style="margin:0 0 12px;color:#4a4a4a">This address already has access to the directory — you can sign in now without waiting for anyone.</p>
            ${BUTTON(signInUrl, 'Sign in instead')}`
         : ''
     }`,
    'If you did not ask for directory access, ignore this message. Nothing happens without the code.',
  );

  return { subject: `${code} is your SXCCAA verification code`, text, html };
}

/**
 * Told to the Association when a verified request joins the queue.
 *
 * Deliberately contentless: a count and a link. No name, no address, no reason.
 * The mailbox this lands in is often shared and rarely the most carefully
 * guarded thing the Association owns.
 */
export function adminNewRequestEmail(pending: number, portalUrl: string): Omit<Mail, 'to'> {
  const noun = pending === 1 ? 'request is' : 'requests are';
  const link = `${portalUrl.replace(/\/$/, '')}/requests`;

  const text = [
    `${pending} access ${noun} waiting in the SXCCAA admin portal`,
    '',
    'Sign in to review. This message deliberately contains no details — they are in the portal.',
    '',
    link,
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">${pending} access ${noun} waiting</h1>
     <p style="margin:0 0 28px;color:#4a4a4a">Sign in to review. This message deliberately carries no details.</p>
     ${BUTTON(link, 'Open the portal')}`,
    'You are receiving this because you administer the SXCCAA alumni directory.',
  );

  return { subject: `SXCCAA: ${pending} access ${noun} waiting`, text, html };
}

/**
 * Escape text for an HTML email body.
 *
 * The enquiry message is free text typed by a stranger into a public form and
 * is the only user-supplied content this file interpolates into HTML. React
 * escapes everything on the site itself; these templates are plain strings, so
 * they do not, and this is the one place it matters.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface Enquiry {
  name: string;
  email: string;
  message: string;
  /** Which page the form was on, so a reply has some context. */
  source: string;
}

/**
 * A general enquiry, forwarded to the Association's mailbox.
 *
 * Unlike every other template in this file, this one **does** carry its
 * contents. The rule those follow — no PII in the body — exists because they
 * are about alumni in the directory, and a shared mailbox is the wrong place
 * for that. An enquiry is different: the contents *are* the message, the sender
 * chose to send them, and forwarding a question to the people who can answer it
 * is the entire purpose.
 *
 * What the message still does not contain is anything about anyone else.
 */
export function enquiryEmail(enquiry: Enquiry): Omit<Mail, 'to'> {
  const text = [
    `From: ${enquiry.name} <${enquiry.email}>`,
    `Sent from: ${enquiry.source}`,
    '',
    enquiry.message || '(no message)',
    '',
    '—',
    'Reply-to is set to the sender, so replying goes straight back to them.',
    'That address has NOT been verified — anyone can type any address into a public form.',
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 16px;font-size:20px;font-weight:600">Enquiry from ${escapeHtml(enquiry.name)}</h1>
     <p style="margin:0 0 4px;color:#4a4a4a"><strong>Email:</strong> ${escapeHtml(enquiry.email)}</p>
     <p style="margin:0 0 20px;color:#8a8a8a;font-size:13px">Sent from ${escapeHtml(enquiry.source)}</p>
     <div style="white-space:pre-wrap;padding:16px 18px;background:#f6f5f3;border-radius:10px;color:#1a1a1a">${escapeHtml(enquiry.message) || '<em style="color:#8a8a8a">(no message)</em>'}</div>`,
    'Replying goes straight back to the sender. That address has <strong>not</strong> been verified — anyone can type any address into a public form.',
  );

  return {
    // The name is in the subject so a shared mailbox can be scanned at a glance.
    subject: `SXCCAA enquiry from ${enquiry.name}`,
    text,
    html,
    replyTo: enquiry.email,
  };
}

/**
 * The invitation — the first message five hundred people receive.
 *
 * This one is worth more care than the rest. For most recipients it is the only
 * thing they will ever read about how their data is handled, and it arrives
 * unsolicited, years after they filled in a form they have forgotten.
 *
 * So it answers, in order, the three questions someone actually has:
 *
 *   1. **Why am I getting this?** Because they filled in the Association's form.
 *      Said plainly and first, because an unexplained email about a "directory"
 *      containing your phone number reads as a breach notification.
 *   2. **What can other people see?** The five public fields, named. Not
 *      "certain information" — the actual list, so nobody has to sign in to
 *      find out what is already visible.
 *   3. **How do I change it?** A link, and the three switches named explicitly.
 *
 * The opt-out is in the body, not buried in a footer. Under the DPDP Act
 * withdrawal must be as easy as the consent was, and a link that says "remove
 * me" is the honest reading of that.
 */
export function alumniInviteEmail(signInUrl: string, profileUrl: string): Omit<Mail, 'to'> {
  const text = [
    'You are listed in the SXCCAA alumni directory',
    '',
    'You filled in the Association\'s alumni form, and the directory it was collecting for is now live. This is the one email telling you so.',
    '',
    'WHAT EVERYONE CAN SEE',
    '',
    'Your name, the year you left, your stream, your current organisation and your role. That is all — the same five things for every Xaverian.',
    '',
    'WHAT ONLY SIGNED-IN XAVERIANS CAN SEE',
    '',
    'Your contact number and your email address, and only if you leave those switched on. Nobody who has not signed in can see either, ever.',
    '',
    'YOUR PROFILE',
    '',
    'Open your profile to change any of it:',
    '',
    profileUrl,
    '',
    'There are three switches there:',
    '  - show my photograph, and to whom',
    '  - show my contact number to signed-in Xaverians',
    '  - show my email address to signed-in Xaverians',
    '',
    'You can also correct your job details, add a photograph, or remove yourself from the directory entirely. That last one takes one click and needs nobody\'s approval.',
    '',
    'SIGNING IN',
    '',
    'There is no password. Enter this address and we email you a six-digit code:',
    '',
    signInUrl,
    '',
    'If you would rather not be listed at all, open your profile and choose "remove me from the directory". Nothing is held against you and you can come back whenever you like.',
  ].join('\n');

  const html = WRAP(
    `<h1 style="margin:0 0 16px;font-size:22px;font-weight:600">You are listed in the alumni directory</h1>
     <p style="margin:0 0 24px;color:#4a4a4a">You filled in the Association&rsquo;s alumni form, and the directory it was collecting for is now live. This is the one email telling you so.</p>

     <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a8a8a">What everyone can see</p>
     <p style="margin:0 0 20px;color:#4a4a4a">Your name, the year you left, your stream, your current organisation and your role. That is all &mdash; the same five things for every Xaverian.</p>

     <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a8a8a">What only signed-in Xaverians can see</p>
     <p style="margin:0 0 24px;color:#4a4a4a">Your contact number and your email address &mdash; and only if you leave those switched on. Nobody who has not signed in can see either, ever.</p>

     ${BUTTON(profileUrl, 'Open my profile')}

     <p style="margin:24px 0 8px;color:#4a4a4a">There are three switches there:</p>
     <ul style="margin:0 0 20px;padding-left:20px;color:#4a4a4a">
       <li>show my photograph, and to whom</li>
       <li>show my contact number to signed-in Xaverians</li>
       <li>show my email address to signed-in Xaverians</li>
     </ul>
     <p style="margin:0 0 24px;color:#4a4a4a">You can also correct your job details, add a photograph, or remove yourself from the directory entirely. That last one takes one click and needs nobody&rsquo;s approval.</p>

     <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a8a8a">Signing in</p>
     <p style="margin:0 0 8px;color:#4a4a4a">There is no password. Enter this address at <a href="${signInUrl}" style="color:#133e6d">the sign-in page</a> and we email you a six-digit code.</p>`,
    'Would rather not be listed? Open your profile and choose &ldquo;remove me from the directory&rdquo;. One click, nobody&rsquo;s approval needed, and you can come back whenever you like.',
  );

  return { subject: 'You are listed in the SXCCAA alumni directory', text, html };
}
