/**
 * The general enquiry form — "have a question?".
 *
 * Distinct from the access request in `access-request.ts`, and deliberately so.
 * An enquiry is a question that goes to a mailbox; an access request asks a
 * person to add an address to an allowlist, needs a code from the applicant's
 * inbox, and is refused by default. Running them through one pipeline would
 * make both worse.
 *
 * ## Why this cannot be turned into a spam relay
 *
 * That is the risk with any unauthenticated endpoint that sends mail, and the
 * property that closes it is simple: **the recipient is fixed.** Every message
 * goes to the Association's own mailbox, read from configuration. There is no
 * input anywhere that influences who receives anything, so the worst an abuser
 * achieves is filling the Association's inbox — which the rate limit, the
 * honeypot and Turnstile between them make tedious.
 *
 * ## Nothing is stored
 *
 * No table, no row, no retention policy to write. The message is forwarded and
 * forgotten. A database of unstructured free text from the public is a store of
 * personal data that would need securing, backing up, and deleting on request,
 * in exchange for duplicating what a mailbox already does well.
 *
 * The cost of that choice is that a failed send is a lost enquiry — which is
 * exactly the bug this module exists to fix. So the send is **synchronous** and
 * its result is reported honestly: the form says "sent" only when Resend
 * accepted the message, and when it did not it says so and offers the
 * Association's address instead.
 */

import { normaliseEmail } from './core/email.ts';
import { audit } from './audit.ts';
import { db, type Sql } from './db.ts';
import { enquiryEmail, mailConfig, send } from './email.ts';
import { LIMITS, consume } from './rate-limit.ts';

/** Long enough for a real question, short enough not to be a payload. */
const LIMITS_TEXT = { name: 120, message: 4000 } as const;

export interface EnquiryInput {
  name: unknown;
  email: unknown;
  message: unknown;
  /** The consent checkbox. Checked here as well as in the browser — see below. */
  consent: unknown;
  /** The path the form was submitted from. Used for context in the email only. */
  source: unknown;
}

export type EnquiryOutcome =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'rate_limited' | 'undeliverable'; message: string };

/** Where enquiries go. Falls back to the access-request mailbox, which is the same team. */
export function enquiryRecipient(): string | null {
  return process.env.ENQUIRY_TO_EMAIL ?? process.env.ADMIN_NOTIFY_EMAIL ?? null;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** A path, and only a path. Never echoed into HTML without escaping either. */
function safeSource(value: unknown): string {
  const raw = text(value, 120);
  return /^\/[A-Za-z0-9\-/_]*$/.test(raw) ? raw : 'the website';
}

export async function submitEnquiry(
  input: EnquiryInput,
  context: { ipSubject: Buffer },
  sql: Sql = db(),
): Promise<EnquiryOutcome> {
  const name = text(input.name, LIMITS_TEXT.name);
  const message = text(input.message, LIMITS_TEXT.message);

  if (!name) {
    return { ok: false, reason: 'invalid', message: 'Please tell us your name.' };
  }

  const email = normaliseEmail(input.email);
  if (!email.ok || !email.value) {
    return { ok: false, reason: 'invalid', message: 'Please give an email address we can reply to.' };
  }

  if (!message) {
    return { ok: false, reason: 'invalid', message: 'Please write your message.' };
  }

  /*
   * The consent box is enforced here as well as by the browser.
   *
   * Not as a security control — a bot can send the field as easily as omit it,
   * and the honeypot and Turnstile are what actually stop bots. It is here so
   * the checkbox is not decoration: a tickbox that changes nothing on the
   * server is the same class of thing as a form that posts nowhere, which is
   * the bug this module was written to fix.
   */
  if (input.consent !== 'on' && input.consent !== 'true') {
    return {
      ok: false,
      reason: 'invalid',
      message: 'Please confirm you agree to the privacy policy and terms of use.',
    };
  }

  const limit = await consume(context.ipSubject, LIMITS.enquiryIpDay, sql);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'That is several messages from this connection today. Please email the Association directly.',
    };
  }

  const to = enquiryRecipient();
  if (!to) {
    // A deployment with nowhere to send enquiries is a misconfiguration, and the
    // visitor must not be told "sent". This is the failure the old form hid.
    console.error('[enquiry] ENQUIRY_TO_EMAIL and ADMIN_NOTIFY_EMAIL are both unset — nothing was sent.');
    return {
      ok: false,
      reason: 'undeliverable',
      message: 'We could not send that just now. Please email the Association directly.',
    };
  }

  try {
    await send(
      {
        to,
        ...enquiryEmail({ name, email: email.value, message, source: safeSource(input.source) }),
      },
      mailConfig(),
    );
  } catch (error) {
    console.error('[enquiry] could not forward the message:', (error as Error).message);
    return {
      ok: false,
      reason: 'undeliverable',
      message: 'We could not send that just now. Please email the Association directly.',
    };
  }

  // Counts and flags only. The enquiry itself is in the mailbox, and a second
  // copy in the audit log is a second copy nobody is watching.
  await audit(
    {
      actorType: 'anonymous',
      action: 'enquiry_sent',
      ipHash: context.ipSubject,
      meta: { source: safeSource(input.source), message_length: message.length },
    },
    sql,
  );

  // Persist to contact_message so admins can review enquiries in the portal.
  // Wrapped in try/catch: the email already succeeded, so a DB hiccup here
  // should not tell the visitor their message was lost.
  try {
    await sql`
      insert into contact_message (name, email, message, source)
      values (${name}, ${email.value}, ${message}, ${safeSource(input.source)})
    `;
  } catch (error) {
    console.error('[enquiry] could not persist to contact_message:', (error as Error).message);
  }

  return { ok: true };
}
