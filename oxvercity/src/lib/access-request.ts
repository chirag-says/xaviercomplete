/**
 * Asking the Association for directory access.
 *
 * For someone the spreadsheet does not cover, or an alumnus whose address has
 * changed. The request is queued for an admin; nothing here grants anything.
 *
 * ## There is no one-time code, and the queue says so
 *
 * An earlier version mailed a six-digit code and would not queue a request
 * until it came back. That step was removed when the form became single-step,
 * and for a while the removal was only half done: `submitAccessRequest` still
 * stamped `email_verified_at`, so every request reached the portal wearing a
 * green "Verified" badge for a check that no longer ran. An admin approving in
 * good faith was reading evidence of something nobody had done.
 *
 * So the column is left alone now. `email_verified_at` stays null, the queue
 * shows "Address not confirmed", and approving requires the admin to say out
 * loud that they have satisfied themselves some other way. A control that has
 * been removed should look removed.
 *
 * ## What the code was actually worth, so it can be restored knowingly
 *
 * It never kept strangers out. Somebody asking for access with their own inbox
 * passes an inbox check trivially, and whether they are a Xaverian was always
 * the admin's judgement and always will be (plan §7.3).
 *
 * What it bought was narrower: nobody could put a *third party's* address into
 * the queue. Without it, anyone can type a stranger's address into the form.
 * The damage ceiling is low — the grant email and every later sign-in code go
 * to that address, not to whoever submitted the form, so an address cannot be
 * captured this way — but the Association can be talked into adding someone who
 * never asked. That is the trade being made, and it is made in the open.
 *
 * Turnstile on the route covers the bot half, and the rate limits below cover
 * the flood half.
 *
 * ## What this module refuses to reveal
 *
 * Submitting the form returns the same answer whether the address is already an
 * alumnus, already has access, has a request outstanding, or has never been
 * seen. Anything else turns the form into a way to test whether a given person
 * is a Xaverian — the disclosure the whole allowlist design exists to prevent.
 */

import { encryptField, fieldContext } from './core/crypto.ts';
import { emailBlindIndex } from './core/hmac.ts';
import { audit } from './audit.ts';
import { db, type Sql } from './db.ts';
import { adminNewRequestEmail, mailConfig, send } from './email.ts';
import { LIMITS, consume } from './rate-limit.ts';

export interface RequestFields {
  name: unknown;
  email: unknown;
  batchYear: unknown;
  stream: unknown;
  reason: unknown;
}

export type SubmitOutcome =
  | { ok: true }
  | { ok: false; reason: 'invalid'; message: string }
  | { ok: false; reason: 'rate_limited'; message: string };

/**
 * How deferred work runs. The route passes Next's `after()` so the mail send
 * happens once the response is flushed; the default awaits inline to keep tests
 * and the verifier deterministic.
 */
export type Scheduler = (task: () => Promise<void>) => void | Promise<void>;
const runInline: Scheduler = (task) => task();

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
}

function batchYearOf(value: unknown): number | null {
  const parsed = Number(typeof value === 'string' ? value.trim() : value);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) return null;
  return parsed;
}

/**
 * Take a request and queue it for admin review.
 *
 * `email_verified_at` is deliberately not set. Nothing in this flow proves the
 * submitter can read mail at the address they typed, so writing a timestamp
 * that says otherwise would be the portal lying to the person who has to make
 * the decision. See the header.
 */
export async function submitAccessRequest(
  fields: RequestFields,
  context: { ipSubject: Buffer; ip: string | null },
  sql: Sql = db(),
  schedule: Scheduler = runInline,
): Promise<SubmitOutcome> {
  const name = text(fields.name, 120);
  const reason = text(fields.reason, 2000);
  const stream = text(fields.stream, 120);
  const batchYear = batchYearOf(fields.batchYear);

  if (!name) {
    return { ok: false, reason: 'invalid', message: 'Please give the name the Association would know you by.' };
  }

  const identity = emailBlindIndex(fields.email);
  if (!identity.ok) {
    return { ok: false, reason: 'invalid', message: 'That does not look like an email address.' };
  }

  // Rate limits
  const perIp = await consume(context.ipSubject, LIMITS.accessRequestIpDay, sql);
  if (!perIp.allowed) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'That is several requests from this connection today. Please try again tomorrow.',
    };
  }
  const perEmail = await consume(identity.hmac, LIMITS.accessRequestEmailDay, sql);
  if (!perEmail.allowed) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: 'We have already received a request for that address today. Please try again tomorrow.',
    };
  }

  // Check for an existing pending request from the same address
  const existing = await sql<Array<{ id: string }>>`
    select id from access_request
     where email_hmac = ${identity.hmac} and status = 'pending'
     order by created_at desc
     limit 1
  `;

  let requestId: string;

  if (existing[0]) {
    // Update the existing request rather than creating a duplicate
    requestId = existing[0].id;
    await sql`
      update access_request
         set name = ${name}, batch_year = ${batchYear}, stream = ${stream}, reason = ${reason},
             request_ip_hash = ${context.ipSubject}
       where id = ${requestId}
    `;
  } else {
    const rows = await sql<Array<{ id: string }>>`
      insert into access_request (
        email_enc, email_hmac, name, batch_year, stream, reason, request_ip_hash
      ) values (
        ${encryptField(identity.normalised, fieldContext('access_request', 'pending', 'email'))},
        ${identity.hmac}, ${name}, ${batchYear}, ${stream}, ${reason}, ${context.ipSubject}
      )
      returning id
    `;
    requestId = rows[0]!.id;

    // Rebind the ciphertext to the row it landed in
    await sql`
      update access_request
         set email_enc = ${encryptField(identity.normalised, fieldContext('access_request', requestId, 'email'))}
       where id = ${requestId}
    `;
  }

  await audit(
    {
      actorType: 'anonymous',
      action: 'access_request_submitted',
      targetType: 'access_request',
      targetId: requestId,
      ipHash: context.ipSubject,
      meta: { updated_existing: Boolean(existing[0]) },
    },
    sql,
  );

  // Notify admins that a request is waiting
  await schedule(async () => {
    await notifyAdmins(sql);
  });

  return { ok: true };
}

/**
 * Tell the Association something is waiting.
 *
 * A count and nothing else — no name, no address, no reason. A mailbox is the
 * least controlled place this data could sit, and an Association mailbox is
 * often shared (plan §8 step 4). The admin signs in to see who it is.
 *
 * The count is every pending row. It used to filter on `email_verified_at is
 * not null`, which was correct while a code had to come back first and is now
 * a filter that matches nothing — the notification would have said "0 requests
 * are waiting" for the rest of the system's life.
 *
 * Failure is logged and swallowed: the request is already queued, and a mail
 * provider having a bad afternoon must not turn a successful submission into an
 * error the applicant cannot act on.
 */
async function notifyAdmins(sql: Sql): Promise<void> {
  try {
    const to = process.env.ADMIN_NOTIFY_EMAIL;
    if (!to) {
      console.warn('[access-request] ADMIN_NOTIFY_EMAIL is not set — nobody was told about the new request.');
      return;
    }

    const rows = await sql<Array<{ count: number }>>`
      select count(*)::int as count from access_request where status = 'pending'
    `;
    const pending = rows[0]?.count ?? 1;

    const config = mailConfig();
    await send({ to, ...adminNewRequestEmail(pending, process.env.ADMIN_URL ?? config.appUrl) }, config);
  } catch (error) {
    console.error('[access-request] could not notify the Association:', (error as Error).message);
  }
}
