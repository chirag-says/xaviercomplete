/**
 * Asking the Association for directory access.
 *
 * For someone the spreadsheet does not cover, or an alumnus whose address has
 * changed. The request is queued for an admin; nothing here grants anything.
 *
 * ## Why the one-time code exists
 *
 * Without it, anyone could put someone else's address into the queue, and an
 * admin approving in good faith would add an address its owner never asked for
 * to the allowlist. The code proves the person filling in the form can read
 * mail at the address they typed. It is not proof they are a Xaverian — that is
 * the admin's judgement, and always will be (plan §7.3).
 *
 * ## What this module refuses to reveal
 *
 * Submitting the form returns the same answer whether the address is already an
 * alumnus, already has access, has a request outstanding, or has never been
 * seen. Anything else turns the form into a way to test whether a given person
 * is a Xaverian — the disclosure the whole allowlist design exists to prevent.
 *
 * The *email* can say more than the response can, because it only reaches the
 * address in question. Someone who already has access is told so there.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

import { encryptField, fieldContext } from './core/crypto.ts';
import { emailBlindIndex } from './core/hmac.ts';
import { newOtp } from './core/ids.ts';
import { audit } from './audit.ts';
import { db, type Sql } from './db.ts';
import { accessRequestOtpEmail, adminNewRequestEmail, mailConfig, send } from './email.ts';
import { LIMITS, consume } from './rate-limit.ts';

export const OTP_LIFETIME_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 5;

/** The stored form. The code itself is never written down. */
const hashOtp = (code: string) => createHash('sha256').update(code, 'utf8').digest();

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
 * Take a request and send a code.
 *
 * An outstanding, unverified request for the same address is **updated** rather
 * than duplicated: someone who did not receive the first code will submit the
 * form again, and that should send a fresh code, not build a queue of near
 * identical rows for an admin to wade through.
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

  // Limits before anything else, and before the lookup, so a throttled response
  // costs the same whoever is asking.
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
      message: 'We have sent several codes to that address today. Please try again tomorrow.',
    };
  }

  const code = newOtp();
  const expiresAt = new Date(Date.now() + OTP_LIFETIME_MINUTES * 60 * 1000);

  const existing = await sql<Array<{ id: string }>>`
    select id from access_request
     where email_hmac = ${identity.hmac} and status = 'pending' and email_verified_at is null
     order by created_at desc
     limit 1
  `;

  let requestId: string;

  if (existing[0]) {
    requestId = existing[0].id;
    await sql`
      update access_request
         set name = ${name}, batch_year = ${batchYear}, stream = ${stream}, reason = ${reason},
             otp_hash = ${hashOtp(code)}, otp_expires_at = ${expiresAt}, otp_attempts = 0,
             request_ip_hash = ${context.ipSubject}
       where id = ${requestId}
    `;
  } else {
    const rows = await sql<Array<{ id: string }>>`
      insert into access_request (
        email_enc, email_hmac, name, batch_year, stream, reason,
        otp_hash, otp_expires_at, request_ip_hash
      ) values (
        ${encryptField(identity.normalised, fieldContext('access_request', 'pending', 'email'))},
        ${identity.hmac}, ${name}, ${batchYear}, ${stream}, ${reason},
        ${hashOtp(code)}, ${expiresAt}, ${context.ipSubject}
      )
      returning id
    `;
    requestId = rows[0]!.id;

    // Rebind the ciphertext to the row it landed in (plan §3.2). The id is
    // generated by the database, so it is not known until the insert returns.
    await sql`
      update access_request
         set email_enc = ${encryptField(identity.normalised, fieldContext('access_request', requestId, 'email'))}
       where id = ${requestId}
    `;
  }

  // Does this address already hold access? Used only to change what the *email*
  // says — never the response. Someone who can already sign in should be told
  // so rather than left waiting on an admin.
  const grants = await sql<Array<{ id: string }>>`
    select id from access_grant where email_hmac = ${identity.hmac} and revoked_at is null limit 1
  `;
  const alreadyHasAccess = grants.length > 0;

  await schedule(async () => {
    try {
      const config = mailConfig();
      await send(
        {
          to: identity.normalised,
          ...accessRequestOtpEmail(code, OTP_LIFETIME_MINUTES, alreadyHasAccess, `${config.appUrl}/login`),
        },
        config,
      );
    } catch (error) {
      console.error('[access-request] could not send the code:', (error as Error).message);
    }
  });

  await audit(
    {
      actorType: 'anonymous',
      action: 'access_request_started',
      targetType: 'access_request',
      targetId: requestId,
      ipHash: context.ipSubject,
      meta: { resent: Boolean(existing[0]), already_has_access: alreadyHasAccess },
    },
    sql,
  );

  return { ok: true };
}

export type VerifyOutcome =
  | { ok: true; alreadyQueued: boolean }
  | { ok: false; reason: 'invalid' | 'expired' | 'too_many' | 'rate_limited'; message: string };

/**
 * Check a code and put the request in the queue.
 *
 * Keyed on the address plus the code, not on a request id. Handing out an id
 * would let anyone holding it verify a request they did not make; requiring the
 * address means the two halves must arrive together.
 */
export async function verifyAccessRequest(
  rawEmail: unknown,
  rawCode: unknown,
  context: { ipSubject: Buffer },
  sql: Sql = db(),
  schedule: Scheduler = runInline,
): Promise<VerifyOutcome> {
  const limit = await consume(context.ipSubject, LIMITS.otpVerifyIpHour, sql);
  if (!limit.allowed) {
    return { ok: false, reason: 'rate_limited', message: 'Too many attempts. Please wait an hour and try again.' };
  }

  const identity = emailBlindIndex(rawEmail);
  const code = typeof rawCode === 'string' ? rawCode.replace(/\s/g, '') : '';

  // One message for a wrong code, an unknown address and a malformed one. The
  // three are indistinguishable on purpose.
  const wrong: VerifyOutcome = {
    ok: false,
    reason: 'invalid',
    message: 'That code was not right. Check the most recent email and try again.',
  };

  if (!identity.ok || !/^\d{6}$/.test(code)) return wrong;

  const rows = await sql<
    Array<{ id: string; otp_hash: Buffer | null; otp_expires_at: Date | null; otp_attempts: number; verified: Date | null }>
  >`
    select id, otp_hash, otp_expires_at, otp_attempts, email_verified_at as verified
      from access_request
     where email_hmac = ${identity.hmac} and status = 'pending'
     order by created_at desc
     limit 1
  `;
  const request = rows[0];
  if (!request) return wrong;

  // Already verified. Say so rather than reporting a wrong code: the person has
  // done everything asked of them and needs to know they are waiting on a human.
  if (request.verified) return { ok: true, alreadyQueued: true };

  if (request.otp_attempts >= MAX_OTP_ATTEMPTS) {
    return {
      ok: false,
      reason: 'too_many',
      message: 'Too many wrong codes for this request. Ask for a new code and start again.',
    };
  }
  if (!request.otp_hash || !request.otp_expires_at || request.otp_expires_at < new Date()) {
    return { ok: false, reason: 'expired', message: 'That code has expired. Ask for a new one.' };
  }

  const expected = Buffer.from(request.otp_hash);
  const actual = hashOtp(code);
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    // `least(..., 5)` because the column is constrained to 0–5; a sixth
    // increment would raise rather than record the attempt.
    await sql`
      update access_request set otp_attempts = least(otp_attempts + 1, ${MAX_OTP_ATTEMPTS}) where id = ${request.id}
    `;
    await audit(
      {
        actorType: 'anonymous',
        action: 'access_request_code_rejected',
        targetType: 'access_request',
        targetId: request.id,
        ipHash: context.ipSubject,
      },
      sql,
    );
    return wrong;
  }

  // Verified. The code is cleared in the same statement — it has done its job,
  // and a spent code sitting in the row is one more thing that could leak.
  await sql`
    update access_request
       set email_verified_at = now(), otp_hash = null, otp_expires_at = null
     where id = ${request.id}
  `;

  await audit(
    {
      actorType: 'anonymous',
      action: 'access_request_verified',
      targetType: 'access_request',
      targetId: request.id,
      ipHash: context.ipSubject,
    },
    sql,
  );

  await schedule(async () => {
    await notifyAdmins(sql);
  });

  return { ok: true, alreadyQueued: false };
}

/**
 * Tell the Association something is waiting.
 *
 * A count and nothing else — no name, no address, no reason. A mailbox is the
 * least controlled place this data could sit, and an Association mailbox is
 * often shared (plan §8 step 4). The admin signs in to see who it is.
 *
 * Failure is logged and swallowed: the request is already queued, and a mail
 * provider having a bad afternoon must not turn a successful verification into
 * an error the applicant cannot act on.
 */
async function notifyAdmins(sql: Sql): Promise<void> {
  try {
    const to = process.env.ADMIN_NOTIFY_EMAIL;
    if (!to) {
      console.warn('[access-request] ADMIN_NOTIFY_EMAIL is not set — nobody was told about the new request.');
      return;
    }

    const rows = await sql<Array<{ count: number }>>`
      select count(*)::int as count from access_request
       where status = 'pending' and email_verified_at is not null
    `;
    const pending = rows[0]?.count ?? 1;

    const config = mailConfig();
    await send({ to, ...adminNewRequestEmail(pending, process.env.ADMIN_URL ?? config.appUrl) }, config);
  } catch (error) {
    console.error('[access-request] could not notify the Association:', (error as Error).message);
  }
}

/** Housekeeping: codes that can no longer be used are of no further value. */
export async function sweepExpiredCodes(sql: Sql = db()): Promise<number> {
  const rows = await sql`
    update access_request
       set otp_hash = null, otp_expires_at = null
     where otp_hash is not null and otp_expires_at < now() - interval '1 day'
    returning id
  `;
  return rows.length;
}
