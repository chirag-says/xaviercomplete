/**
 * Mailing the alumni: choosing who, preparing the poster, and sending.
 *
 * **Server only.** Reaches the database and the encryption key.
 *
 * ## The three rules this module holds
 *
 * 1. **One message, one recipient.** Every send is its own request with a
 *    single address in `to`. There is no code path here that can put two
 *    addresses on one message, because the one thing that must never happen is
 *    five hundred Xaverians learning each other's email addresses from a
 *    mis-set BCC. Removing the possibility beats remembering not to do it.
 *
 * 2. **The recipient list is written down before anything is sent.** Resolving
 *    the segment and sending in one pass would mean a crash halfway leaves no
 *    record of who was reached, and the only safe recovery is to send to
 *    nobody or to send to everybody again. Rows first, then a chunked loop that
 *    marks each one — so a retry continues rather than repeats.
 *
 * 3. **An address is decrypted at the moment it is used and never stored.**
 *    Not in the broadcast row, not in the recipient row, not in the audit log.
 *    A mailing is a reason to read five hundred addresses, not a reason to make
 *    a second copy of them.
 *
 * ## Why recipients come from `alumni`
 *
 * `access_grant` — the sign-in allowlist — holds a blind index and nothing
 * else, on purpose, so there is no address in it to write to. The directory
 * record is where an address lives. The consequence is worth stating plainly:
 * somebody granted access who has no directory record yet **cannot be mailed**,
 * and the compose screen says so rather than quietly sending to fewer people
 * than the admin expected.
 */

import sharp from 'sharp';

import { adminDb, type Sql } from './db.ts';
import {
  audit,
  decryptOptional,
  fieldContext,
  CryptoIntegrityError,
  send,
  mailConfig,
  unsubscribeToken,
  type Attachment,
} from './shared.ts';
import { broadcastEmail } from './email.ts';

export type SegmentKind = 'everyone' | 'batch' | 'stream';

export interface Segment {
  kind: SegmentKind;
  /** The batch year as a string, or the stream. Null when kind is 'everyone'. */
  value: string | null;
}

/**
 * How many messages one call of {@link sendChunk} will attempt.
 *
 * Sized against the server action's time budget rather than the provider's rate
 * limit: fifteen sends with a poster attached is a few seconds, comfortably
 * inside any timeout, and small enough that the progress bar on the compose
 * screen actually moves. Raising it makes each round trip longer without
 * sending the mailing any faster overall.
 */
export const CHUNK_SIZE = 15;

export const MAX_POSTER_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Wide enough to look right on a laptop, small enough to send five hundred times. */
const POSTER_MAX_WIDTH = 1400;

// --- choosing who ------------------------------------------------------------

export interface SegmentOption {
  value: string;
  /** How many people in this segment can actually be mailed. */
  count: number;
}

export interface SegmentOptions {
  batches: SegmentOption[];
  streams: SegmentOption[];
  everyone: number;
  /** On the allowlist, but no directory record — so no address to write to. */
  unreachableGrants: number;
  optedOut: number;
}

/**
 * The one condition every recipient must meet, written once.
 *
 * Interpolated into the queries below rather than repeated, because a mailing
 * that honours the opt-out in the count and forgets it in the send is worse
 * than one that never had an opt-out: it reports the right number and mails
 * somebody who asked not to be mailed.
 */
const MAILABLE = `gmail_enc is not null and email_opt_out = false`;

/**
 * The batches and streams worth offering, each with its live count.
 *
 * Segments with nobody in them are not listed. An admin choosing "Class of
 * 1987" from a dropdown and then being told it matches nobody has been led
 * there by the interface.
 */
export async function segmentOptions(sql: Sql = adminDb()): Promise<SegmentOptions> {
  const [batches, streams, totals] = await Promise.all([
    sql<Array<{ value: string; count: number }>>`
      select batch_year::text as value, count(*)::int as count
        from alumni where ${sql.unsafe(MAILABLE)}
       group by batch_year order by batch_year desc
    `,
    sql<Array<{ value: string; count: number }>>`
      select stream as value, count(*)::int as count
        from alumni where ${sql.unsafe(MAILABLE)} and stream is not null and btrim(stream) <> ''
       group by stream order by stream
    `,
    sql<Array<{ everyone: number; opted_out: number; unreachable: number }>>`
      select
        (select count(*)::int from alumni where ${sql.unsafe(MAILABLE)}) as everyone,
        (select count(*)::int from alumni where email_opt_out) as opted_out,
        (select count(*)::int from access_grant g
          where g.revoked_at is null
            and not exists (select 1 from alumni a where a.gmail_hmac = g.email_hmac)
        ) as unreachable
    `,
  ]);

  const row = totals[0]!;
  return {
    batches,
    streams,
    everyone: row.everyone,
    optedOut: row.opted_out,
    unreachableGrants: row.unreachable,
  };
}

/** How many people a segment would reach, for the confirmation before sending. */
export async function countSegment(segment: Segment, sql: Sql = adminDb()): Promise<number> {
  const rows = await sql<Array<{ count: number }>>`
    select count(*)::int as count from alumni
     where ${sql.unsafe(MAILABLE)}
       and ${
         segment.kind === 'everyone'
           ? sql`true`
           : segment.kind === 'batch'
             ? sql`batch_year = ${Number(segment.value)}`
             : sql`stream = ${segment.value}`
       }
  `;
  return rows[0]?.count ?? 0;
}

// --- the poster --------------------------------------------------------------

export type PosterResult =
  | { ok: true; bytes: Buffer; contentType: 'image/jpeg'; width: number; height: number; filename: string }
  | { ok: false; message: string };

/**
 * Re-encode an uploaded poster.
 *
 * Always re-encoded, never passed through. Three reasons, in order of how much
 * they matter:
 *
 *   - A photograph of a printed poster taken on a phone carries the GPS
 *     coordinates of wherever it was taken, and `sharp` drops all metadata by
 *     default on re-encode.
 *   - The declared type of an upload is a claim. Decoding and re-encoding means
 *     what we store and attach is what `sharp` produced, not what the filename
 *     said.
 *   - Four megabytes multiplied by five hundred recipients is two gigabytes of
 *     upload and a deliverability problem. Resizing to 1400px wide brings a
 *     typical poster to a couple of hundred kilobytes.
 */
export async function processPoster(input: Buffer, originalName: string): Promise<PosterResult> {
  if (input.byteLength === 0) return { ok: false, message: 'That file was empty.' };
  if (input.byteLength > MAX_POSTER_UPLOAD_BYTES) {
    return { ok: false, message: 'That image is larger than 8 MB. Export a smaller copy and try again.' };
  }

  try {
    const pipeline = sharp(input, { failOn: 'error' });
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) {
      return { ok: false, message: 'That file does not look like an image we can read.' };
    }

    const bytes = await pipeline
      .rotate() // honour the EXIF orientation before that data is dropped
      .resize({ width: POSTER_MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    const out = await sharp(bytes).metadata();

    // A poster is mostly text. If it still will not fit after the resize, say
    // so rather than sending something the provider or the recipient's server
    // will reject at the far end.
    if (bytes.byteLength > 2 * 1024 * 1024) {
      return { ok: false, message: 'That image is too detailed to attach. Try exporting it at a lower quality.' };
    }

    return {
      ok: true,
      bytes,
      contentType: 'image/jpeg',
      width: out.width ?? meta.width,
      height: out.height ?? meta.height,
      filename: posterFilename(originalName),
    };
  } catch {
    return { ok: false, message: 'That image could not be processed. Try exporting it again, or use a different one.' };
  }
}

/**
 * A safe attachment filename.
 *
 * The uploaded name is chosen by a person and lands in a header and then on a
 * recipient's disk, so it is reduced to a known alphabet rather than trusted.
 * Always `.jpg`, because the re-encode above always produces JPEG.
 */
function posterFilename(originalName: string): string {
  const stem = originalName
    .replace(/\.[^.]*$/, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .slice(0, 60);
  return `${stem === '' ? 'poster' : stem}.jpg`;
}

// --- creating the mailing ----------------------------------------------------

export interface DraftBroadcast {
  subject: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  segment: Segment;
  poster: Extract<PosterResult, { ok: true }> | null;
}

/**
 * Write the mailing and its recipient list down, without sending anything.
 *
 * One transaction: a broadcast row whose recipient list half-exists is a
 * mailing that would go to a subset nobody chose.
 *
 * The recipient set is snapshotted here rather than recomputed per chunk. If
 * somebody unsubscribes while a long send is running, the row is still in the
 * list — which is why `sendChunk` re-checks the flag at the moment it sends.
 */
export async function createBroadcast(
  draft: DraftBroadcast,
  adminId: string,
  sql: Sql = adminDb(),
): Promise<{ id: string; recipients: number }> {
  const { segment } = draft;

  const created = await sql.begin(async (tx) => {
    const rows = await tx<Array<{ id: string }>>`
      insert into broadcast (subject, body, link_url, link_label, segment_kind, segment_value, created_by, status)
      values (
        ${draft.subject}, ${draft.body}, ${draft.linkUrl}, ${draft.linkLabel},
        ${segment.kind}, ${segment.value}, ${adminId}, 'draft'
      )
      returning id
    `;
    const id = rows[0]!.id;

    if (draft.poster) {
      await tx`
        insert into broadcast_poster (broadcast_id, bytes, content_type, width, height, filename)
        values (${id}, ${draft.poster.bytes}, ${draft.poster.contentType},
                ${draft.poster.width}, ${draft.poster.height}, ${draft.poster.filename})
      `;
    }

    const inserted = await tx<Array<{ id: string }>>`
      insert into broadcast_recipient (broadcast_id, alumni_id)
      select ${id}, a.id from alumni a
       where a.gmail_enc is not null
         and a.email_opt_out = false
         and ${
           segment.kind === 'everyone'
             ? tx`true`
             : segment.kind === 'batch'
               ? tx`a.batch_year = ${Number(segment.value)}`
               : tx`a.stream = ${segment.value}`
         }
      returning id
    `;

    return { id, recipients: inserted.length };
  });

  // After the commit rather than inside it, matching every other write in the
  // portal. `audit` swallows its own failures by design, so having it in the
  // transaction would mean a logging problem could roll back a mailing that is
  // otherwise fine — the wrong way round for a record that exists to observe.
  await audit(
    {
      actorType: 'admin',
      actorId: adminId,
      action: 'broadcast_created',
      targetType: 'broadcast',
      targetId: created.id,
      // Counts and the segment. Never an address, never a name, and not the
      // body — an audit row is not a second copy of the message.
      meta: {
        segment_kind: segment.kind,
        segment_value: segment.value,
        recipients: created.recipients,
        has_poster: draft.poster !== null,
      },
    },
    sql,
  );

  return created;
}

// --- sending -----------------------------------------------------------------

export interface Progress {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  status: 'draft' | 'sending' | 'sent' | 'cancelled';
  done: boolean;
}

export async function readProgress(broadcastId: string, sql: Sql = adminDb()): Promise<Progress | null> {
  const [meta, counts] = await Promise.all([
    sql<Array<{ status: Progress['status'] }>>`select status from broadcast where id = ${broadcastId} limit 1`,
    sql<Array<{ status: string; n: number }>>`
      select status, count(*)::int as n from broadcast_recipient
       where broadcast_id = ${broadcastId} group by status
    `,
  ]);
  if (!meta[0]) return null;

  const by = (name: string) => counts.find((row) => row.status === name)?.n ?? 0;
  const pending = by('pending');

  return {
    total: counts.reduce((sum, row) => sum + row.n, 0),
    sent: by('sent'),
    failed: by('failed'),
    skipped: by('skipped'),
    pending,
    status: meta[0].status,
    done: pending === 0,
  };
}

interface SendContext {
  subject: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  posterUrl: string | null;
  attachment: Attachment | null;
  appUrl: string;
}

/** Everything needed to render and send, loaded once per chunk rather than per recipient. */
async function loadContext(broadcastId: string, sql: Sql): Promise<SendContext | null> {
  const rows = await sql<
    Array<{ subject: string; body: string; link_url: string | null; link_label: string | null; status: string }>
  >`select subject, body, link_url, link_label, status from broadcast where id = ${broadcastId} limit 1`;
  const row = rows[0];
  if (!row || row.status === 'cancelled') return null;

  const posters = await sql<Array<{ bytes: Buffer; filename: string }>>`
    select bytes, filename from broadcast_poster where broadcast_id = ${broadcastId} limit 1
  `;
  const poster = posters[0];
  const config = mailConfig();

  return {
    subject: row.subject,
    body: row.body,
    linkUrl: row.link_url,
    linkLabel: row.link_label,
    posterUrl: poster ? `${config.appUrl}/api/poster/${broadcastId}` : null,
    attachment: poster ? { filename: poster.filename, content: Buffer.from(poster.bytes) } : null,
    appUrl: config.appUrl,
  };
}

/**
 * Send the next batch.
 *
 * Called repeatedly by the compose screen until `done`. Each recipient is
 * claimed with an UPDATE that requires it to still be pending, so two admins
 * with the page open — or one admin who double-clicked — cannot both send to
 * the same person. The claim moves the row out of 'pending' *before* the
 * provider call, which is the deliberate trade: a crash mid-send leaves that
 * one row marked failed rather than pending, so the worst case is one person
 * not receiving a mailing rather than one person receiving it twice.
 */
export async function sendChunk(broadcastId: string, sql: Sql = adminDb()): Promise<Progress | null> {
  const context = await loadContext(broadcastId, sql);
  if (!context) return readProgress(broadcastId, sql);

  await sql`
    update broadcast
       set status = 'sending', started_at = coalesce(started_at, now())
     where id = ${broadcastId} and status = 'draft'
  `;

  // Claim, and pick up the address in the same statement. `email_opt_out` is
  // read here rather than trusted from the snapshot: somebody may have
  // unsubscribed since the list was built, possibly from this very mailing's
  // earlier chunk, and honouring that matters more than the tidiness of the
  // list.
  const claimed = await sql<
    Array<{ id: string; alumni_id: string; gmail_enc: Buffer | null; email_opt_out: boolean }>
  >`
    update broadcast_recipient r
       set status = 'failed', reason = 'interrupted'
      from alumni a
     where r.alumni_id = a.id
       and r.id in (
         select id from broadcast_recipient
          where broadcast_id = ${broadcastId} and status = 'pending'
          order by id
          limit ${CHUNK_SIZE}
          for update skip locked
       )
    returning r.id, r.alumni_id, a.gmail_enc, a.email_opt_out
  `;

  for (const recipient of claimed) {
    let outcome: { status: 'sent' | 'failed' | 'skipped'; reason: string | null } = {
      status: 'failed',
      reason: 'provider_error',
    };

    try {
      if (recipient.email_opt_out) {
        outcome = { status: 'skipped', reason: 'opted_out' };
      } else {
        const address = decryptAddress(recipient.gmail_enc, recipient.alumni_id);
        if (!address) {
          outcome = { status: 'skipped', reason: recipient.gmail_enc ? 'undecryptable' : 'no_address' };
        } else {
          const unsubscribeUrl =
            `${context.appUrl}/unsubscribe?id=${encodeURIComponent(recipient.alumni_id)}` +
            `&t=${encodeURIComponent(unsubscribeToken(recipient.alumni_id))}`;

          await send({
            to: address,
            ...broadcastEmail({
              subject: context.subject,
              body: context.body,
              linkUrl: context.linkUrl,
              linkLabel: context.linkLabel,
              posterUrl: context.posterUrl,
              unsubscribeUrl,
            }),
            ...(context.attachment ? { attachments: [context.attachment] } : {}),
          });
          outcome = { status: 'sent', reason: null };
        }
      }
    } catch (error) {
      // The provider's message can echo the recipient's address back at us, so
      // it goes to the server log and a reason code goes to the database.
      console.error('[broadcast] send failed:', (error as Error).message);
      outcome = { status: 'failed', reason: 'provider_error' };
    }

    await sql`
      update broadcast_recipient
         set status = ${outcome.status}, reason = ${outcome.reason},
             sent_at = ${outcome.status === 'sent' ? new Date() : null}
       where id = ${recipient.id}
    `;
  }

  const progress = await readProgress(broadcastId, sql);

  if (progress?.done && progress.status === 'sending') {
    await sql`update broadcast set status = 'sent', finished_at = now() where id = ${broadcastId}`;
    await audit(
      {
        actorType: 'system',
        action: 'broadcast_finished',
        targetType: 'broadcast',
        targetId: broadcastId,
        meta: { sent: progress.sent, failed: progress.failed, skipped: progress.skipped },
      },
      sql,
    );
    return { ...progress, status: 'sent' };
  }

  return progress;
}

/** Decrypt one address, or give up on that recipient alone. */
function decryptAddress(blob: Buffer | null, alumniId: string): string | null {
  try {
    return decryptOptional(blob, fieldContext('alumni', alumniId, 'gmail'));
  } catch (error) {
    if (error instanceof CryptoIntegrityError) {
      // Names the cell, never the value. One unreadable row must not stop a
      // mailing to four hundred and ninety-nine other people.
      console.error(`[broadcast] gmail on ${alumniId} failed to decrypt: ${error.message}`);
      return null;
    }
    throw error;
  }
}

/** Stop a mailing that is part way through. Everything already sent has gone. */
export async function cancelBroadcast(broadcastId: string, adminId: string, sql: Sql = adminDb()): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    update broadcast set status = 'cancelled', finished_at = now()
     where id = ${broadcastId} and status in ('draft', 'sending')
    returning id
  `;
  if (rows.length === 0) return false;

  const stopped = await sql<Array<{ id: string }>>`
    update broadcast_recipient set status = 'skipped', reason = 'cancelled'
     where broadcast_id = ${broadcastId} and status = 'pending'
    returning id
  `;

  await audit(
    {
      actorType: 'admin',
      actorId: adminId,
      action: 'broadcast_cancelled',
      targetType: 'broadcast',
      targetId: broadcastId,
      meta: { not_sent: stopped.length },
    },
    sql,
  );
  return true;
}

// --- history -----------------------------------------------------------------

export interface BroadcastRow {
  id: string;
  subject: string;
  segmentKind: SegmentKind;
  segmentValue: string | null;
  status: Progress['status'];
  createdAt: Date;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  hasPoster: boolean;
}

export async function listBroadcasts(limit = 40, sql: Sql = adminDb()): Promise<BroadcastRow[]> {
  const rows = await sql<
    Array<{
      id: string;
      subject: string;
      segment_kind: SegmentKind;
      segment_value: string | null;
      status: Progress['status'];
      created_at: Date;
      total: number;
      sent: number;
      failed: number;
      skipped: number;
      has_poster: boolean;
    }>
  >`
    select b.id, b.subject, b.segment_kind, b.segment_value, b.status, b.created_at,
           count(r.id)::int                                            as total,
           count(r.id) filter (where r.status = 'sent')::int           as sent,
           count(r.id) filter (where r.status = 'failed')::int         as failed,
           count(r.id) filter (where r.status = 'skipped')::int        as skipped,
           exists (select 1 from broadcast_poster p where p.broadcast_id = b.id) as has_poster
      from broadcast b
      left join broadcast_recipient r on r.broadcast_id = b.id
     group by b.id
     order by b.created_at desc
     limit ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    segmentKind: row.segment_kind,
    segmentValue: row.segment_value,
    status: row.status,
    createdAt: row.created_at,
    total: row.total,
    sent: row.sent,
    failed: row.failed,
    skipped: row.skipped,
    hasPoster: row.has_poster,
  }));
}

/** How a segment reads on screen and in the history. */
export function describeSegment(kind: SegmentKind, value: string | null): string {
  if (kind === 'everyone') return 'Everyone in the directory';
  if (kind === 'batch') return `Class of ${value}`;
  return `${value} stream`;
}
