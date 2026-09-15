/**
 * Prove that a stolen copy of the database is worthless.
 *
 *   npm run restore:proof
 *
 * This is the check the whole design rests on, and the one the plan calls out
 * as worth doing above all the others (§10.8). Every claim made to the
 * Association — that a leaked dump, a provider breach or a stolen backup yields
 * nothing — reduces to a single question: **if somebody had the bytes and not
 * the key, could they read a phone number?**
 *
 * Everything else in this repository tests behaviour with the key present.
 * This tests the opposite, which is the case that actually matters.
 *
 * ## What it does
 *
 * 1. Writes one alumnus, one admin and one access request with known values,
 *    through the ordinary application code, as the ordinary roles.
 * 2. Reads the raw bytes back out of the tables — the same bytes `pg_dump`
 *    would write and a thief would carry away.
 * 3. Searches those bytes for the plaintext. Any hit is a failure.
 * 4. Attempts to decrypt with a **wrong key**, which must fail rather than
 *    return something.
 * 5. Attempts to decrypt with the right key but the wrong row's context, which
 *    must also fail — ciphertext is welded to the cell it belongs in.
 * 6. Removes everything it made.
 *
 * ## What it deliberately does not do
 *
 * It does not take a real backup. `pg_dump` against Supabase needs a matching
 * client binary and network access this environment does not have, and the
 * question it would answer is the same one asked here: the dump contains the
 * bytes in these columns, so if the bytes are ciphertext the dump is ciphertext.
 * Section 15 of the plan records the manual `pg_dump` drill to run once against
 * the real backup before launch.
 */

import { randomBytes } from 'node:crypto';

import { connect, type Sql } from '../../src/lib/db.ts';
import {
  CryptoIntegrityError,
  decryptField,
  encryptField,
  fieldContext,
} from '../../src/lib/core/crypto.ts';
import { parseKeyring } from '../../src/lib/core/keys.ts';
import { blindIndexOfNormalised } from '../../src/lib/core/hmac.ts';

/**
 * Values planted and then hunted for. Distinctive enough that a match in a blob
 * cannot be a coincidence, and none of them belongs to anybody.
 */
const PLANTED = {
  alumniId: 'restrpruf999',
  name: 'Restore Proof Subject',
  contact: '+919876500777',
  gmail: 'restore.proof.777@example.org',
  otherInfo: 'CANARY-OTHER-INFO-RESTORE-777',
  formEmail: 'restore.proof.form.777@example.org',
  requestName: 'Restore Proof Applicant',
  requestEmail: 'restore.proof.applicant@example.org',
};

let passed = 0;
let failed = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

async function clean(owner: Sql): Promise<void> {
  await owner`delete from alumni where id = ${PLANTED.alumniId}`;
  await owner`delete from access_request where email_hmac = ${blindIndexOfNormalised(PLANTED.requestEmail)}`;
}

/** Every secret that must not appear anywhere in the stored bytes. */
const SECRETS = [
  PLANTED.contact,
  PLANTED.gmail,
  PLANTED.otherInfo,
  PLANTED.formEmail,
  PLANTED.requestEmail,
];

async function main(): Promise<void> {
  const owner = connect(process.env.DATABASE_URL ?? '', { max: 2, application_name: 'sxccaa-restoreproof' });

  try {
    await clean(owner);

    // --- plant ---------------------------------------------------------------
    process.stdout.write('\n  Writing records the ordinary way\n');

    const enc = (value: string, field: string) =>
      encryptField(value, fieldContext('alumni', PLANTED.alumniId, field));

    await owner`
      insert into alumni (
        id, full_name, batch_year, stream, current_org, designation,
        contact_enc, gmail_enc, other_info_enc, form_email_enc, gmail_hmac,
        show_contact, show_gmail
      ) values (
        ${PLANTED.alumniId}, ${PLANTED.name}, 2009, 'B.Sc.', 'Proof Ltd', 'Subject',
        ${enc(PLANTED.contact, 'contact')},
        ${enc(PLANTED.gmail, 'gmail')},
        ${enc(PLANTED.otherInfo, 'otherInfo')},
        ${enc(PLANTED.formEmail, 'formEmail')},
        ${blindIndexOfNormalised(PLANTED.gmail)},
        true, true
      )
    `;

    const requestRows = await owner<Array<{ id: string }>>`
      insert into access_request (email_enc, email_hmac, name, reason)
      values (
        ${encryptField(PLANTED.requestEmail, fieldContext('access_request', 'pending', 'email'))},
        ${blindIndexOfNormalised(PLANTED.requestEmail)},
        ${PLANTED.requestName},
        'Restore proof run.'
      )
      returning id
    `;
    const requestId = requestRows[0]!.id;
    await owner`
      update access_request
         set email_enc = ${encryptField(PLANTED.requestEmail, fieldContext('access_request', requestId, 'email'))}
       where id = ${requestId}
    `;
    report(true, 'one alumnus and one access request written');

    // --- the bytes a thief would carry away -----------------------------------
    process.stdout.write('\n  What a stolen dump actually contains\n');

    const alumniRow = (
      await owner<
        Array<{
          full_name: string;
          contact_enc: Buffer;
          gmail_enc: Buffer;
          other_info_enc: Buffer;
          form_email_enc: Buffer;
          gmail_hmac: Buffer;
        }>
      >`
        select full_name, contact_enc, gmail_enc, other_info_enc, form_email_enc, gmail_hmac
          from alumni where id = ${PLANTED.alumniId}
      `
    )[0]!;

    const requestRow = (
      await owner<Array<{ email_enc: Buffer; email_hmac: Buffer; name: string }>>`
        select email_enc, email_hmac, name from access_request where id = ${requestId}
      `
    )[0]!;

    // Everything a dump of these two rows would hold, concatenated. Searching
    // the lot at once means a field moved to a different column is still caught.
    const dump = Buffer.concat([
      Buffer.from(alumniRow.full_name, 'utf8'),
      alumniRow.contact_enc,
      alumniRow.gmail_enc,
      alumniRow.other_info_enc,
      alumniRow.form_email_enc,
      alumniRow.gmail_hmac,
      requestRow.email_enc,
      requestRow.email_hmac,
      Buffer.from(requestRow.name, 'utf8'),
    ]);

    for (const secret of SECRETS) {
      report(
        !dump.includes(Buffer.from(secret, 'utf8')),
        `"${secret.slice(0, 22)}…" does not appear in the stored bytes`,
      );
    }

    // Also check the hex and base64 renderings — a dump is text, and a value
    // that survived an encoding step would be missed by a raw byte search.
    const hex = dump.toString('hex');
    const base64 = dump.toString('base64');
    for (const secret of SECRETS) {
      const asHex = Buffer.from(secret, 'utf8').toString('hex');
      report(
        !hex.includes(asHex) && !base64.includes(Buffer.from(secret, 'utf8').toString('base64')),
        `nor in its hex or base64 form (${secret.slice(0, 16)}…)`,
      );
    }

    // The name and the batch year are public by design and *should* be readable.
    // Asserting that too keeps this honest: the point is that the confidential
    // columns are unreadable, not that everything is.
    report(
      dump.includes(Buffer.from(PLANTED.name, 'utf8')),
      'the public name IS readable, as designed — this is not a blanket claim',
    );

    // --- the key is what matters ---------------------------------------------
    process.stdout.write('\n  Without the key, the bytes are noise\n');

    const wrongKeyring = parseKeyring(`1:${randomBytes(32).toString('base64')}`, 'WRONG_KEY');

    let wrongKeyFailed = false;
    try {
      decryptField(
        alumniRow.contact_enc,
        fieldContext('alumni', PLANTED.alumniId, 'contact'),
        wrongKeyring,
      );
    } catch (error) {
      wrongKeyFailed = error instanceof CryptoIntegrityError;
    }
    report(wrongKeyFailed, 'a different key cannot read the contact number');

    let wrongContextFailed = false;
    try {
      decryptField(alumniRow.contact_enc, fieldContext('alumni', 'someoneelse1', 'contact'));
    } catch (error) {
      wrongContextFailed = error instanceof CryptoIntegrityError;
    }
    report(wrongContextFailed, 'and the right key cannot read it into another row');

    let wrongFieldFailed = false;
    try {
      decryptField(alumniRow.contact_enc, fieldContext('alumni', PLANTED.alumniId, 'gmail'));
    } catch (error) {
      wrongFieldFailed = error instanceof CryptoIntegrityError;
    }
    report(wrongFieldFailed, 'nor into another column of the same row');

    let crossTableFailed = false;
    try {
      decryptField(requestRow.email_enc, fieldContext('alumni', PLANTED.alumniId, 'gmail'));
    } catch (error) {
      crossTableFailed = error instanceof CryptoIntegrityError;
    }
    report(crossTableFailed, 'nor across tables');

    // --- with the key, it still works ----------------------------------------
    process.stdout.write('\n  With the key, everything reads back exactly\n');

    report(
      decryptField(alumniRow.contact_enc, fieldContext('alumni', PLANTED.alumniId, 'contact')) === PLANTED.contact,
      'the contact number round-trips',
    );
    report(
      decryptField(alumniRow.gmail_enc, fieldContext('alumni', PLANTED.alumniId, 'gmail')) === PLANTED.gmail,
      'the address round-trips',
    );
    report(
      decryptField(requestRow.email_enc, fieldContext('access_request', requestId, 'email')) === PLANTED.requestEmail,
      'the access request address round-trips',
    );

    // --- the blind index ------------------------------------------------------
    process.stdout.write('\n  The allowlist index is one-way\n');

    report(
      alumniRow.gmail_hmac.length === 32,
      'the blind index is a fixed 32 bytes, carrying no length information',
    );
    report(
      !alumniRow.gmail_hmac.includes(Buffer.from(PLANTED.gmail.slice(0, 8), 'utf8')),
      'and no fragment of the address it indexes',
    );
    report(
      blindIndexOfNormalised(PLANTED.gmail).equals(alumniRow.gmail_hmac),
      'it is reproducible from the address plus the pepper — which is how login works',
    );
  } finally {
    await clean(owner);
    await owner.end({ timeout: 5 });
  }

  process.stdout.write(`\n  ${passed} passed, ${failed} failed.\n`);
  process.stdout.write(
    failed === 0
      ? '\n  A stolen copy of this database is a file of noise.\n\n'
      : '\n  Something confidential is readable in the stored bytes. Stop and fix it.\n\n',
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

await main();
