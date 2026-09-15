/**
 * Exercise the whole mailing flow against the live database and real Resend.
 *
 *   npm run broadcast:verify
 *
 * The unit tests cover the pure parts — escaping, the template, the segment
 * description. This covers what only a real database and a real provider can
 * answer: does the recipient snapshot actually match the segment, does a send
 * resume where it stopped instead of starting again, does an opt-out taken
 * *during* a send stop that person's copy, and is there really no address
 * anywhere in the tables this feature adds.
 *
 * Everything it creates, it removes — except audit rows, which are append-only
 * by design and are a fair record of what happened.
 *
 * Mail goes to `delivered@resend.dev`, Resend's sink address, so the provider
 * call is real without anyone receiving anything.
 */

import sharp from 'sharp';

import { adminDb, closeAdminDb, type Sql } from '../src/lib/db.ts';
import { encryptOptional, fieldContext, blindIndexOfNormalised, unsubscribeToken } from '../src/lib/shared.ts';
import { unsubscribeTokenMatches } from '../../oxvercity/src/lib/core/hmac.ts';
import {
  CHUNK_SIZE,
  countSegment,
  createBroadcast,
  describeSegment,
  processPoster,
  readProgress,
  segmentOptions,
  sendChunk,
  cancelBroadcast,
} from '../src/lib/broadcast.ts';
import { broadcastEmail } from '../src/lib/email.ts';

const SINK = 'delivered@resend.dev';
/** Enough to need more than one chunk, so resumability is actually exercised. */
const COHORT = CHUNK_SIZE + 4;
const TEST_YEAR = 2091;
const TEST_STREAM = 'Verification Studies';
const PREFIX = 'zz9v';

let passed = 0;
let failed = 0;

function report(ok: boolean, name: string, detail = ''): void {
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? `\n      ${detail}` : ''}\n`);
  if (ok) passed++;
  else failed++;
}

/**
 * Alumni ids are checked against `^[2-9a-km-np-z]{12}$` — no `0`, `1`, `l` or
 * `o`, the four characters people mistype reading an id off a screen. So the
 * counter is encoded in that alphabet rather than written as decimal, which
 * would smuggle a `0` in at n = 0 and be refused by the constraint.
 */
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyz';

function idFor(n: number): string {
  let out = '';
  let value = n;
  do {
    out = ALPHABET[value % ALPHABET.length] + out;
    value = Math.floor(value / ALPHABET.length);
  } while (value > 0);
  return `${PREFIX}${out.padStart(12 - PREFIX.length, '2')}`;
}

async function clean(sql: Sql): Promise<void> {
  await sql`delete from broadcast_recipient where alumni_id like ${`${PREFIX}%`}`;
  await sql`delete from broadcast b where not exists (
              select 1 from broadcast_recipient r where r.broadcast_id = b.id)
            and b.subject like 'Verification:%'`;
  await sql`delete from alumni where id like ${`${PREFIX}%`}`;
}

async function seed(sql: Sql): Promise<string[]> {
  const ids: string[] = [];
  for (let n = 0; n < COHORT; n++) {
    const id = idFor(n);
    ids.push(id);
    await sql`
      insert into alumni (id, full_name, batch_year, stream, gmail_enc, gmail_hmac, show_gmail, consent_note)
      values (
        ${id}, ${`Verification Person ${n}`}, ${TEST_YEAR}, ${TEST_STREAM},
        ${encryptOptional(SINK, fieldContext('alumni', id, 'gmail'))},
        ${blindIndexOfNormalised(`verify-${id}@example.invalid`)},
        false, 'Synthetic record created by broadcast:verify.'
      )
    `;
  }
  return ids;
}

/**
 * A real PNG, generated rather than pasted as base64.
 *
 * Poster-shaped and wider than the 1400px ceiling, so the resize path is
 * actually exercised instead of being skipped by `withoutEnlargement`.
 */
function posterPng(): Promise<Buffer> {
  return sharp({
    create: { width: 1800, height: 2400, channels: 3, background: { r: 190, g: 40, b: 45 } },
  })
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const sql = adminDb();
  /**
   * `created_by` is a nullable FK to admin_user, and this script has no admin.
   * Null is the honest value: nobody signed in to create these, and the column
   * already means "the admin who did it, if we still know".
   */
  const ADMIN = null as unknown as string;

  try {
    await clean(sql);
    const ids = await seed(sql);

    // --- choosing who --------------------------------------------------------
    process.stdout.write('\n  A segment means what it says\n');

    const options = await segmentOptions(sql);
    const batch = options.batches.find((b) => b.value === String(TEST_YEAR));
    const stream = options.streams.find((s) => s.value === TEST_STREAM);

    report(batch?.count === COHORT, 'the batch is offered with its real count', `got ${batch?.count}`);
    report(stream?.count === COHORT, 'the stream is offered with its real count', `got ${stream?.count}`);

    const byBatch = await countSegment({ kind: 'batch', value: String(TEST_YEAR) }, sql);
    const byStream = await countSegment({ kind: 'stream', value: TEST_STREAM }, sql);
    const everyone = await countSegment({ kind: 'everyone', value: null }, sql);

    report(byBatch === COHORT, 'counting a batch agrees with the dropdown');
    report(byStream === COHORT, 'counting a stream agrees with the dropdown');
    report(everyone >= COHORT, 'everyone is at least this cohort', `got ${everyone}`);

    // Opt one person out and prove every count drops by exactly one.
    await sql`update alumni set email_opt_out = true, email_opt_out_at = now() where id = ${ids[0]!}`;
    const afterOptOut = await countSegment({ kind: 'batch', value: String(TEST_YEAR) }, sql);
    report(afterOptOut === COHORT - 1, 'an unsubscribed person leaves the segment', `got ${afterOptOut}`);

    // --- the poster ----------------------------------------------------------
    process.stdout.write('\n  The poster is re-encoded, never passed through\n');

    const source = await posterPng();
    const poster = await processPoster(source, '../../etc/Nasty Name!.png');
    report(poster.ok, 'a PNG is accepted', poster.ok ? '' : poster.message);
    if (poster.ok) {
      report(poster.contentType === 'image/jpeg', 'and comes back as JPEG, whatever went in');
      report(poster.width <= 1400, 'an oversized poster is resized down', `${poster.width}px wide`);
      report(
        !poster.filename.includes('/') && !poster.filename.includes('!') && poster.filename.endsWith('.jpg'),
        'the attachment filename is reduced to a safe one',
        poster.filename,
      );
      report(
        !poster.bytes.subarray(0, 8).equals(source.subarray(0, 8)),
        'the stored bytes are not the uploaded bytes',
      );
      report(
        poster.bytes.byteLength < 2 * 1024 * 1024,
        'and are small enough to attach to every message',
        `${Math.round(poster.bytes.byteLength / 1024)} KB`,
      );
    }

    const notAnImage = await processPoster(Buffer.from('this is not an image'), 'x.png');
    report(!notAnImage.ok, 'a file that is not an image is refused');

    // --- creating, without sending -------------------------------------------
    process.stdout.write('\n  Preparing a mailing sends nothing\n');

    const created = await createBroadcast(
      {
        subject: 'Verification: Annual Reunion',
        body: 'Line one.\n\nLine two with <script>alert(1)</script> in it.',
        linkUrl: 'https://example.org/events',
        linkLabel: 'Details',
        segment: { kind: 'batch', value: String(TEST_YEAR) },
        poster: poster.ok ? poster : null,
      },
      ADMIN,
      sql,
    );

    report(
      created.recipients === COHORT - 1,
      'the recipient list is the segment minus the unsubscribed',
      `got ${created.recipients}`,
    );

    const optedOutRows = await sql`
      select 1 from broadcast_recipient where broadcast_id = ${created.id} and alumni_id = ${ids[0]!}
    `;
    report(optedOutRows.length === 0, 'the unsubscribed person is not even on the list');

    const before = await readProgress(created.id, sql);
    report(before?.sent === 0 && before?.status === 'draft', 'nothing is sent until asked');

    // --- what the tables hold ------------------------------------------------
    process.stdout.write('\n  No address is stored anywhere new\n');

    const addressColumns = await sql<Array<{ n: number }>>`
      select count(*)::int as n from information_schema.columns
       where table_name in ('broadcast', 'broadcast_recipient', 'broadcast_poster')
         and (column_name like '%email%' or column_name like '%mail%' or column_name like '%address%')
    `;
    report(addressColumns[0]!.n === 0, 'the broadcast tables have no column that could hold an address');

    const leak = await sql<Array<{ n: number }>>`
      select count(*)::int as n from broadcast
       where subject like ${`%${SINK}%`} or body like ${`%${SINK}%`}
    `;
    report(leak[0]!.n === 0, 'and no address has leaked into a subject or body');

    // --- sending, in chunks --------------------------------------------------
    process.stdout.write('\n  Sending is chunked and resumable\n');

    const first = await sendChunk(created.id, sql);
    report(first?.sent === CHUNK_SIZE, 'one chunk sends exactly the chunk size', `sent ${first?.sent}`);
    report((first?.pending ?? 0) > 0, 'and leaves the rest pending', `pending ${first?.pending}`);
    report(first?.status === 'sending', 'the mailing is marked as in progress');

    /*
     * Someone unsubscribes between chunks — from this very mailing's footer.
     *
     * The person has to be picked from the rows that are *still pending*, not
     * by position in the seed array. Recipients are ordered by their row id,
     * which is a random uuid, so "the last one I created" may well have gone
     * out in the first chunk — and a test that opted that person out would pass
     * or fail depending on the shuffle.
     */
    const stillPending = await sql<Array<{ alumni_id: string }>>`
      select alumni_id from broadcast_recipient
       where broadcast_id = ${created.id} and status = 'pending' limit 1
    `;
    const lateUnsubscriber = stillPending[0]!.alumni_id;
    await sql`update alumni set email_opt_out = true, email_opt_out_at = now() where id = ${lateUnsubscriber}`;

    const second = await sendChunk(created.id, sql);
    report(second?.done === true, 'the next chunk finishes the mailing', `pending ${second?.pending}`);
    report(second?.status === 'sent', 'and the mailing is marked sent');
    report(
      second?.skipped === 1,
      'the person who unsubscribed mid-send is skipped, not mailed',
      `skipped ${second?.skipped}`,
    );
    report(
      (second?.sent ?? 0) === COHORT - 2,
      'everyone else received exactly one copy',
      `sent ${second?.sent} of an expected ${COHORT - 2}`,
    );

    const sentRows = await sql<Array<{ n: number }>>`
      select count(*)::int as n from broadcast_recipient
       where broadcast_id = ${created.id} and status = 'sent' and sent_at is null
    `;
    report(sentRows[0]!.n === 0, 'every sent row carries the time it went');

    const again = await sendChunk(created.id, sql);
    report(again?.sent === second?.sent, 'sending again after it has finished mails nobody twice');

    // --- the message itself --------------------------------------------------
    process.stdout.write('\n  What lands in the mailbox\n');

    const unsubUrl = `https://example.org/unsubscribe?id=${ids[1]!}&t=${unsubscribeToken(ids[1]!)}`;
    const mail = broadcastEmail({
      subject: 'Verification: Annual Reunion',
      body: 'Line one.\n\nLine two with <script>alert(1)</script> in it.',
      linkUrl: 'https://example.org/events',
      linkLabel: 'Details',
      posterUrl: 'https://example.org/api/poster/abc',
      unsubscribeUrl: unsubUrl,
    });

    report(!mail.html.includes('<script>'), 'admin-typed markup is escaped, not rendered');
    report(mail.html.includes('&lt;script&gt;'), 'and appears as the text it was');
    report(mail.html.includes(unsubUrl), 'every message carries an unsubscribe link');
    report(mail.text.includes(unsubUrl), 'including the plain-text part');
    report(mail.html.includes('/api/poster/abc'), 'the poster is shown inline');
    report(mail.text.includes('attached'), 'and the text part says it is attached');
    report(!mail.html.includes(SINK), 'no recipient address appears in the body');

    // --- the unsubscribe token ------------------------------------------------
    process.stdout.write('\n  The unsubscribe link cannot be forged\n');

    const good = unsubscribeToken(ids[1]!);
    report(unsubscribeTokenMatches(ids[1]!, good), "a person's own token matches");
    report(!unsubscribeTokenMatches(ids[2]!, good), "and does not work for somebody else's record");
    report(!unsubscribeTokenMatches(ids[1]!, `${good}x`), 'a tampered token is refused');
    report(!unsubscribeTokenMatches(ids[1]!, ''), 'an empty token is refused');

    // --- cancelling -----------------------------------------------------------
    process.stdout.write('\n  A mailing can be stopped part way\n');

    const toStop = await createBroadcast(
      {
        subject: 'Verification: To Be Cancelled',
        body: 'This one is stopped before it finishes.',
        linkUrl: null,
        linkLabel: null,
        segment: { kind: 'stream', value: TEST_STREAM },
        poster: null,
      },
      ADMIN,
      sql,
    );
    await sendChunk(toStop.id, sql);
    const stopped = await cancelBroadcast(toStop.id, ADMIN, sql);
    const afterStop = await readProgress(toStop.id, sql);

    report(stopped, 'stopping succeeds while it is still running');
    report(afterStop?.status === 'cancelled', 'the mailing is marked cancelled');
    report(afterStop?.pending === 0, 'and nothing is left pending to be picked up later');

    report(
      describeSegment('batch', '2015') === 'Class of 2015' && describeSegment('everyone', null) === 'Everyone in the directory',
      'segments read the way an admin would say them',
    );

    process.stdout.write(
      `\n  ${passed} passed, ${failed} failed.\n\n` +
        (failed === 0 ? '  Mailings behave as designed.\n\n' : '  Do not send to the alumni until it is green.\n\n'),
    );
  } finally {
    await clean(sql).catch(() => {});
    await closeAdminDb();
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`\n  ${(error as Error).stack}\n\n`);
  process.exit(1);
});
