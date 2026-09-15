/**
 * Exercise the access-request flow against the live database and real Resend.
 *
 *   npm run request:verify
 *
 * The unit tests cover the pure parts. This covers what only a real database
 * can answer: does the attempt counter actually bind at five, does a second
 * submission update the outstanding request instead of piling up duplicates,
 * does an expired code really stop working, and can `sxc_web` decide a request
 * it is not supposed to be able to decide.
 *
 * Mail goes to `delivered@resend.dev`, Resend's sink address, so the provider
 * call is real and nobody receives anything.
 *
 * Everything it creates, it removes — except audit rows, which are append-only
 * by design and a fair record of what happened.
 */

import { createHash } from 'node:crypto';

import { connect, type Sql } from '../../src/lib/db.ts';
import { blindIndexOfNormalised, ipBlindIndex } from '../../src/lib/core/hmac.ts';
import { decryptField, fieldContext } from '../../src/lib/core/crypto.ts';
import {
  MAX_OTP_ATTEMPTS,
  submitAccessRequest,
  verifyAccessRequest,
} from '../../src/lib/access-request.ts';

const EMAIL = 'delivered@resend.dev';
const OTHER = 'request.verify.other@example.org';

let passed = 0;
let failed = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

const subjectFor = (label: string) => ipBlindIndex(`request-verify:${label}:${Date.now()}:${Math.random()}`);

const FIELDS = {
  name: 'Request Verify Subject',
  email: EMAIL,
  batchYear: '2011',
  stream: 'B.Com.',
  reason: 'Automated verification run.',
};

async function clean(owner: Sql): Promise<void> {
  for (const address of [EMAIL, OTHER]) {
    const hmac = blindIndexOfNormalised(address);
    await owner`delete from access_request where email_hmac = ${hmac}`;
    await owner`delete from access_grant where email_hmac = ${hmac}`;
  }
  await owner`delete from rate_limit where bucket like 'request:%' or bucket like 'otp:%'`;
}

/** Read the code straight out of the row. Only this verifier may do this. */
async function currentCode(owner: Sql, address: string): Promise<{ id: string; code: string } | null> {
  const rows = await owner<Array<{ id: string; otp_hash: Buffer | null }>>`
    select id, otp_hash from access_request
     where email_hmac = ${blindIndexOfNormalised(address)} and status = 'pending'
     order by created_at desc limit 1
  `;
  const row = rows[0];
  if (!row?.otp_hash) return null;

  // Six digits is a small enough space to walk, which is exactly why the row
  // caps attempts at five and the IP bucket caps them at twenty an hour.
  const target = Buffer.from(row.otp_hash).toString('hex');
  for (let n = 0; n < 1_000_000; n++) {
    const candidate = String(n).padStart(6, '0');
    if (createHash('sha256').update(candidate, 'utf8').digest('hex') === target) {
      return { id: row.id, code: candidate };
    }
  }
  return null;
}

async function main(): Promise<void> {
  const owner = connect(process.env.DATABASE_URL ?? '', { max: 2, application_name: 'sxccaa-requestverify' });
  const web = connect(process.env.WEB_DATABASE_URL ?? '', { max: 2, application_name: 'sxccaa-requestverify-web' });

  try {
    await clean(owner);

    // --- submitting ---------------------------------------------------------
    process.stdout.write('\n  Submitting a request\n');

    const first = await submitAccessRequest(FIELDS, { ipSubject: subjectFor('a'), ip: null }, web);
    report(first.ok, 'a well-formed request is accepted');

    const rows = await owner<Array<{ id: string; email_enc: Buffer; name: string; verified: Date | null; otp_hash: Buffer | null }>>`
      select id, email_enc, name, email_verified_at as verified, otp_hash
        from access_request where email_hmac = ${blindIndexOfNormalised(EMAIL)}
    `;
    report(rows.length === 1, 'one row is written', `found ${rows.length}`);
    const row = rows[0]!;

    report(row.verified === null, 'and it is NOT queued until the code is checked');
    report(row.otp_hash !== null, 'a code is stored as a hash');
    report(
      !row.email_enc.toString('utf8').includes('delivered@'),
      'the address is stored encrypted, not in the clear',
    );
    report(
      decryptField(row.email_enc, fieldContext('access_request', row.id, 'email')) === EMAIL,
      'and decrypts, bound to this row',
    );

    // The AAD is welded to the row id; a blob lifted into another row must fail.
    let swapRejected = false;
    try {
      decryptField(row.email_enc, fieldContext('access_request', 'a-different-id', 'email'));
    } catch {
      swapRejected = true;
    }
    report(swapRejected, 'the address cannot be moved to another request');

    // --- malformed ----------------------------------------------------------
    process.stdout.write('\n  What it refuses\n');

    const noName = await submitAccessRequest(
      { ...FIELDS, name: '   ' },
      { ipSubject: subjectFor('b'), ip: null },
      web,
    );
    report(!noName.ok, 'a request with no name is refused');

    const badEmail = await submitAccessRequest(
      { ...FIELDS, email: 'not-an-address' },
      { ipSubject: subjectFor('c'), ip: null },
      web,
    );
    report(!badEmail.ok, 'a malformed address is refused');

    // --- resubmission -------------------------------------------------------
    process.stdout.write('\n  Asking again replaces the code rather than piling up rows\n');

    const before = await currentCode(owner, EMAIL);
    await submitAccessRequest(FIELDS, { ipSubject: subjectFor('d'), ip: null }, web);
    const after = await currentCode(owner, EMAIL);

    const count = await owner<Array<{ c: number }>>`
      select count(*)::int as c from access_request where email_hmac = ${blindIndexOfNormalised(EMAIL)}
    `;
    report(count[0]!.c === 1, 'still one row, not two', `found ${count[0]!.c}`);
    report(before?.code !== after?.code, 'and the code has changed');
    report(before?.id === after?.id, 'on the same request');

    // --- verifying ----------------------------------------------------------
    process.stdout.write('\n  Checking the code\n');

    const wrong = await verifyAccessRequest(EMAIL, '000000', { ipSubject: subjectFor('e') }, web);
    report(!wrong.ok, 'a wrong code is refused');

    const unknown = await verifyAccessRequest(OTHER, '000000', { ipSubject: subjectFor('f') }, web);
    report(!unknown.ok, 'an address with no request is refused');
    report(
      !wrong.ok && !unknown.ok && wrong.message === unknown.message,
      'and the two are indistinguishable — the form is not an oracle',
    );

    const malformed = await verifyAccessRequest(EMAIL, '12', { ipSubject: subjectFor('g') }, web);
    report(!malformed.ok, 'a short code is refused without touching the row');

    const attempts = await owner<Array<{ otp_attempts: number }>>`
      select otp_attempts from access_request where id = ${row.id}
    `;
    report(
      attempts[0]!.otp_attempts === 1,
      'only the genuinely wrong six-digit attempt was counted',
      `counter is ${attempts[0]!.otp_attempts}`,
    );

    const good = await currentCode(owner, EMAIL);
    const verified = await verifyAccessRequest(EMAIL, good!.code, { ipSubject: subjectFor('h') }, web);
    report(verified.ok, 'the right code is accepted');

    const afterVerify = await owner<Array<{ verified: Date | null; otp_hash: Buffer | null }>>`
      select email_verified_at as verified, otp_hash from access_request where id = ${row.id}
    `;
    report(afterVerify[0]!.verified !== null, 'the request is now queued');
    report(afterVerify[0]!.otp_hash === null, 'and the spent code is cleared from the row');

    const again = await verifyAccessRequest(EMAIL, good!.code, { ipSubject: subjectFor('i') }, web);
    report(
      again.ok && again.alreadyQueued,
      'verifying twice says so rather than reporting a wrong code',
    );

    // --- attempt cap --------------------------------------------------------
    process.stdout.write('\n  Guessing is capped\n');

    await owner`delete from access_request where email_hmac = ${blindIndexOfNormalised(EMAIL)}`;
    await owner`delete from rate_limit where bucket like 'request:%' or bucket like 'otp:%'`;
    await submitAccessRequest(FIELDS, { ipSubject: subjectFor('j'), ip: null }, web);
    const fresh = await currentCode(owner, EMAIL);

    for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) {
      // Avoid the one-in-a-million chance of guessing the real code.
      const miss = fresh!.code === '999999' ? '111111' : '999999';
      await verifyAccessRequest(EMAIL, miss, { ipSubject: subjectFor(`k${i}`) }, web);
    }

    const capped = await owner<Array<{ otp_attempts: number }>>`
      select otp_attempts from access_request where id = ${fresh!.id}
    `;
    report(
      capped[0]!.otp_attempts === MAX_OTP_ATTEMPTS,
      `the counter stops at ${MAX_OTP_ATTEMPTS} rather than breaching the constraint`,
      `counter is ${capped[0]!.otp_attempts}`,
    );

    const locked = await verifyAccessRequest(EMAIL, fresh!.code, { ipSubject: subjectFor('l') }, web);
    report(
      !locked.ok && locked.reason === 'too_many',
      'and the correct code no longer works once the cap is reached',
    );

    // --- expiry -------------------------------------------------------------
    process.stdout.write('\n  A code does not last\n');

    await owner`
      update access_request set otp_attempts = 0, otp_expires_at = now() - interval '1 minute'
       where id = ${fresh!.id}
    `;
    const stale = await verifyAccessRequest(EMAIL, fresh!.code, { ipSubject: subjectFor('m') }, web);
    report(!stale.ok && stale.reason === 'expired', 'an expired code is refused');

    // --- rate limits --------------------------------------------------------
    process.stdout.write('\n  Limits bind\n');

    await owner`delete from rate_limit where bucket like 'request:%' or bucket like 'otp:%'`;
    const oneIp = subjectFor('n');
    const outcomes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await submitAccessRequest(
        { ...FIELDS, email: `request.verify.${i}@example.org` },
        { ipSubject: oneIp, ip: null },
        web,
      );
      outcomes.push(r.ok ? 'ok' : r.reason);
    }
    report(
      outcomes.filter((o) => o === 'ok').length === 3,
      'three requests a day from one connection, then no more',
      outcomes.join(', '),
    );

    for (let i = 0; i < 5; i++) {
      await owner`delete from access_request where email_hmac = ${blindIndexOfNormalised(`request.verify.${i}@example.org`)}`;
    }

    // --- role isolation -----------------------------------------------------
    process.stdout.write('\n  The public site cannot decide a request\n');

    const denied = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        report(false, label, 'the statement succeeded — it should have been refused');
      } catch {
        report(true, label);
      }
    };

    await denied('sxc_web cannot grant access', () =>
      web`insert into access_grant (email_hmac, source) values (${blindIndexOfNormalised(OTHER)}, 'admin_grant')`,
    );
    await denied('sxc_web cannot read the audit log it writes to', () => web`select id from audit_log limit 1`);

    // The status column is writable by sxc_web — the OTP step updates the row —
    // so the database constraint is what stops a decision arriving without an
    // admin attached to it.
    await denied('a decision without an admin is refused by the constraint', () =>
      web`update access_request set status = 'approved' where id = ${fresh!.id}`,
    );
  } finally {
    await clean(owner);
    await Promise.all([owner.end({ timeout: 5 }), web.end({ timeout: 5 })]);
  }

  process.stdout.write(`\n  ${passed} passed, ${failed} failed.\n`);
  process.stdout.write(
    failed === 0
      ? '\n  Every refusal above is the design working.\n\n'
      : '\n  A failure here is a way into the allowlist. Do not deploy.\n\n',
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

await main();
