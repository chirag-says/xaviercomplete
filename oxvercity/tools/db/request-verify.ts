/**
 * Exercise the access-request flow against the live database and real Resend.
 *
 *   npm run request:verify
 *
 * The unit tests cover the pure parts. This covers what only a real database
 * can answer: does a second submission update the outstanding request instead
 * of piling up duplicates, does the ciphertext really refuse to move between
 * rows, do the limits bind, and can `sxc_web` decide a request it is not
 * supposed to be able to decide.
 *
 * ## What this file used to assert, and why it no longer does
 *
 * It used to drive a six-digit code: read the hash out of the row, brute-force
 * the six digits back out of it, and check the attempt cap, the expiry and the
 * single-use rule. That step was removed from the public form, and the removal
 * was for a while only half done — `submitAccessRequest` kept stamping
 * `email_verified_at`, so the portal showed a green "Verified" badge and refused
 * to approve without it, and the check that badge stood for had not run since
 * the form changed.
 *
 * The assertions here are now the other way round, and they are the point of
 * the file: **no request may arrive claiming to be verified.** If somebody
 * restores the code, these three assertions are what will fail and tell them to
 * come back and finish the job in both places.
 *
 * Mail goes to `delivered@resend.dev`, Resend's sink address, so the provider
 * call is real and nobody receives anything.
 *
 * Everything it creates, it removes — except audit rows, which are append-only
 * by design and a fair record of what happened.
 */

import { connect, type Sql } from '../../src/lib/db.ts';
import { blindIndexOfNormalised, ipBlindIndex } from '../../src/lib/core/hmac.ts';
import { decryptField, fieldContext } from '../../src/lib/core/crypto.ts';
import { submitAccessRequest } from '../../src/lib/access-request.ts';

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

async function main(): Promise<void> {
  const owner = connect(process.env.DATABASE_URL ?? '', { max: 2, application_name: 'sxccaa-requestverify' });
  const web = connect(process.env.WEB_DATABASE_URL ?? '', { max: 2, application_name: 'sxccaa-requestverify-web' });

  try {
    await clean(owner);

    // --- submitting ---------------------------------------------------------
    process.stdout.write('\n  Submitting a request\n');

    const first = await submitAccessRequest(FIELDS, { ipSubject: subjectFor('a'), ip: null }, web);
    report(first.ok, 'a well-formed request is accepted');

    const rows = await owner<
      Array<{ id: string; email_enc: Buffer; name: string; verified: Date | null; otp_hash: Buffer | null }>
    >`
      select id, email_enc, name, email_verified_at as verified, otp_hash
        from access_request where email_hmac = ${blindIndexOfNormalised(EMAIL)}
    `;
    report(rows.length === 1, 'one row is written', `found ${rows.length}`);
    const row = rows[0]!;

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

    // --- the claim nobody is allowed to make --------------------------------
    process.stdout.write('\n  Nothing claims the address was checked\n');

    /*
     * These are the assertions this file exists for now.
     *
     * The submitter proved nothing about the mailbox they typed, and the portal
     * must not be told otherwise. A green badge on the screen where somebody
     * decides whether a stranger may read five hundred contact details has to be
     * backed by a check that actually ran.
     */
    report(
      row.verified === null,
      'email_verified_at stays null — no request arrives claiming to be verified',
      row.verified ? `it was stamped ${row.verified.toISOString()}` : '',
    );
    report(row.otp_hash === null, 'no one-time code is minted, so there is none to leak or guess');

    const stamped = await owner<Array<{ c: number }>>`
      select count(*)::int as c from access_request where email_verified_at is not null
    `;
    report(
      stamped[0]!.c === 0,
      'and no row anywhere in the table carries the stamp',
      stamped[0]!.c > 0
        ? `${stamped[0]!.c} row(s) predate the fix — they were auto-stamped and the portal must not read the column`
        : '',
    );

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
    process.stdout.write('\n  Asking again updates the request rather than piling up rows\n');

    await submitAccessRequest(
      { ...FIELDS, reason: 'Second submission, same address.' },
      { ipSubject: subjectFor('d'), ip: null },
      web,
    );

    const resubmitted = await owner<Array<{ id: string; reason: string | null }>>`
      select id, reason from access_request where email_hmac = ${blindIndexOfNormalised(EMAIL)}
    `;
    report(resubmitted.length === 1, 'still one row, not two', `found ${resubmitted.length}`);
    report(resubmitted[0]!.id === row.id, 'on the same request');
    report(resubmitted[0]!.reason === 'Second submission, same address.', 'with the new details');

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

    // The status column is writable by sxc_web — submitting updates the row —
    // so the database constraint is what stops a decision arriving without an
    // admin attached to it.
    await denied('a decision without an admin is refused by the constraint', () =>
      web`update access_request set status = 'approved' where id = ${row.id}`,
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
