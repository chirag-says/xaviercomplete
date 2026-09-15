/**
 * An alumnus's own record: reading it, changing it, and the photograph.
 *
 * **Server only** — reaches the database and the encryption key.
 *
 * ## The one rule that makes /me safe
 *
 * Every function here resolves the record from `session.emailHmac`, which came
 * from the viewer's own cookie. **No function takes an alumni id.** There is
 * therefore no parameter to tamper with, no IDOR to find, and no code path from
 * one alumnus's session to another's record — not because a check is careful,
 * but because the id never crosses the wire in the first place.
 *
 * The one exception is `readPhotoBytes`, which serves a photograph by id to
 * whoever is allowed to see it. It takes a viewer tier and applies the same
 * `photoUrlFor` rules the card and the profile use, so there is one decision
 * about who may see an image rather than two that can disagree.
 */

import { decryptOptional, encryptOptional, fieldContext, CryptoIntegrityError } from './core/crypto.ts';
import { newPhotoKey } from './core/ids.ts';
import { normalisePhone } from './core/phone.ts';
import { audit } from './audit.ts';
import { db, type Sql } from './db.ts';
import type { Session } from './session.ts';
import { processPhoto, type PhotoResult } from './photo.ts';
import {
  photoUrlFor,
  toOwn,
  type OwnAlumnus,
  type PhotoAudience,
  type ViewerTier,
} from './visibility.ts';

function safeDecrypt(blob: Buffer | null, id: string, field: string): string | null {
  try {
    return decryptOptional(blob, fieldContext('alumni', id, field));
  } catch (error) {
    if (error instanceof CryptoIntegrityError) {
      console.error(`[me] ${field} on ${id} failed to decrypt: ${error.message}`);
      return null;
    }
    throw error;
  }
}

interface OwnDbRow {
  id: string;
  full_name: string;
  batch_year: number;
  stream: string | null;
  current_org: string | null;
  designation: string | null;
  previous_role: string | null;
  contact_enc: Buffer | null;
  gmail_enc: Buffer | null;
  other_info_enc: Buffer | null;
  show_contact: boolean;
  show_gmail: boolean;
  photo_audience: string;
  photo_status: string;
  is_visible: boolean;
}

const OWN_COLUMNS = `
  id, full_name, batch_year, stream, current_org, designation, previous_role,
  contact_enc, gmail_enc, other_info_enc, show_contact, show_gmail,
  photo_audience, photo_status, is_visible
`;

function toOwnRecord(row: OwnDbRow): OwnAlumnus {
  return toOwn({
    id: row.id,
    fullName: row.full_name,
    batchYear: row.batch_year,
    stream: row.stream,
    currentOrg: row.current_org,
    designation: row.designation,
    photoAudience: row.photo_audience as PhotoAudience,
    photoStatus: row.photo_status as OwnAlumnus['photoStatus'],
    previousRole: row.previous_role,
    contact: safeDecrypt(row.contact_enc, row.id, 'contact'),
    gmail: safeDecrypt(row.gmail_enc, row.id, 'gmail'),
    otherInfo: safeDecrypt(row.other_info_enc, row.id, 'otherInfo'),
    showContact: row.show_contact,
    showGmail: row.show_gmail,
    isVisible: row.is_visible,
  });
}

/**
 * The signed-in alumnus's own record.
 *
 * Returns null when the session's address is on the allowlist but matches no
 * directory record — which is a real state: an admin can grant access to
 * someone who has not been imported yet. `/me` renders an explanation rather
 * than a 404.
 *
 * `is_visible` is deliberately **not** in the WHERE clause. Someone who has
 * withdrawn from the directory must still be able to reach this page, see that
 * they are withdrawn, and undo it.
 */
export async function readOwnProfile(session: Session, sql: Sql = db()): Promise<OwnAlumnus | null> {
  const rows = await sql<OwnDbRow[]>`
    select ${sql.unsafe(OWN_COLUMNS)} from alumni where gmail_hmac = ${session.emailHmac} limit 1
  `;
  const row = rows[0];
  return row ? toOwnRecord(row) : null;
}

// --- editing -----------------------------------------------------------------

/** What an alumnus may change about themselves (plan §7.1). */
export interface ProfileEdit {
  currentOrg: string | null;
  designation: string | null;
  previousRole: string | null;
  otherInfo: string | null;
  contact: string | null;
  showContact: boolean;
  showGmail: boolean;
  photoAudience: PhotoAudience;
}

export type SaveOutcome =
  | { ok: true; profile: OwnAlumnus }
  | { ok: false; reason: 'no_record' | 'bad_phone'; message: string };

const LIMITS = { currentOrg: 200, designation: 200, previousRole: 400, otherInfo: 2000 } as const;

function clamp(value: string | null, max: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
}

/**
 * Save the fields an alumnus owns.
 *
 * Name, batch year, stream and the sign-in address are absent on purpose — they
 * are the identity fields an admin matches an access request against, and the
 * sign-in address is the account itself (plan §7.1). A free-text name on a
 * public page under the Association's name is also an obvious vandalism target.
 *
 * `owner_updated_at` is stamped so a later spreadsheet re-import leaves these
 * fields alone (§4.2 step 5).
 */
export async function saveOwnProfile(
  session: Session,
  edit: ProfileEdit,
  sql: Sql = db(),
): Promise<SaveOutcome> {
  const rows = await sql<Array<{ id: string; contact_enc: Buffer | null }>>`
    select id, contact_enc from alumni where gmail_hmac = ${session.emailHmac} limit 1
  `;
  const existing = rows[0];
  if (!existing) {
    return { ok: false, reason: 'no_record', message: 'There is no directory record for this address yet.' };
  }
  const id = existing.id;

  // A number that cannot be normalised is refused rather than stored as typed.
  // The directory is only useful if the numbers in it can be dialled.
  let contact: string | null = null;
  if (edit.contact !== null && edit.contact.trim() !== '') {
    const parsed = normalisePhone(edit.contact);
    if (!parsed.ok) {
      return {
        ok: false,
        reason: 'bad_phone',
        message: 'That does not look like a phone number we can store. Include the country code, e.g. +91 98765 43210.',
      };
    }
    contact = parsed.value;
  }

  // A toggle cannot promise a value that is not there — the database constraint
  // `show_contact_needs_a_contact` would refuse the row. Forcing it off here
  // means the alumnus gets a saved profile instead of an error about a
  // constraint they have never heard of.
  const showContact = edit.showContact && contact !== null;

  await sql`
    update alumni set
      current_org      = ${clamp(edit.currentOrg, LIMITS.currentOrg)},
      designation      = ${clamp(edit.designation, LIMITS.designation)},
      previous_role    = ${clamp(edit.previousRole, LIMITS.previousRole)},
      contact_enc      = ${encryptOptional(contact, fieldContext('alumni', id, 'contact'))},
      other_info_enc   = ${encryptOptional(clamp(edit.otherInfo, LIMITS.otherInfo), fieldContext('alumni', id, 'otherInfo'))},
      show_contact     = ${showContact},
      show_gmail       = ${edit.showGmail},
      photo_audience   = ${edit.photoAudience},
      owner_updated_at = now()
    where id = ${id}
  `;

  // Field names and boolean states. Never a value (plan §2.1).
  await audit(
    {
      actorType: 'alumnus',
      actorId: id,
      action: 'profile_updated',
      targetType: 'alumni',
      targetId: id,
      meta: {
        show_contact: showContact,
        show_gmail: edit.showGmail,
        photo_audience: edit.photoAudience,
        contact: contact === null ? 'cleared' : 'set',
      },
    },
    sql,
  );

  const profile = await readOwnProfile(session, sql);
  return profile ? { ok: true, profile } : { ok: false, reason: 'no_record', message: 'Record disappeared mid-save.' };
}

/** Withdraw from, or return to, the directory. DPDP §11 — must be self-service. */
export async function setOwnVisibility(
  session: Session,
  visible: boolean,
  sql: Sql = db(),
): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    update alumni set is_visible = ${visible}, owner_updated_at = now()
     where gmail_hmac = ${session.emailHmac}
    returning id
  `;
  const row = rows[0];
  if (!row) return false;

  await audit(
    {
      actorType: 'alumnus',
      actorId: row.id,
      action: visible ? 'profile_relisted' : 'profile_withdrawn',
      targetType: 'alumni',
      targetId: row.id,
    },
    sql,
  );
  return true;
}

// --- photographs -------------------------------------------------------------

export type UploadOutcome =
  | { ok: true; status: 'live' }
  | { ok: false; message: string };

/**
 * Accept, process and store one photograph.
 *
 * Live immediately — the Association chose no review step (migration 0009), so
 * an alumnus who uploads a picture sees it on their card straight away. An
 * administrator can take one down afterwards if it ever comes to that.
 *
 * The replace is a single transaction — new row in, old row out, `photo_path`
 * repointed — so an old URL dies the moment a new photograph is saved, and a
 * failure halfway leaves the previous photograph intact.
 */
export async function saveOwnPhoto(
  session: Session,
  file: Buffer,
  claimedType: string | undefined,
  sql: Sql = db(),
): Promise<UploadOutcome> {
  const rows = await sql<Array<{ id: string; photo_path: string | null }>>`
    select id, photo_path from alumni where gmail_hmac = ${session.emailHmac} limit 1
  `;
  const record = rows[0];
  if (!record) return { ok: false, message: 'There is no directory record for this address yet.' };

  const result: PhotoResult = await processPhoto(file, claimedType);
  if (!result.ok) {
    await audit(
      {
        actorType: 'alumnus',
        actorId: record.id,
        action: 'photo_rejected',
        targetType: 'alumni',
        targetId: record.id,
        // The reason code, never the filename and never the bytes.
        meta: { reason: result.reason },
      },
      sql,
    );
    return { ok: false, message: result.message };
  }

  const path = newPhotoKey();
  const { webp, jpeg, width, height, sourceType, sourceBytes } = result.photo;

  await sql.begin(async (tx) => {
    if (record.photo_path) {
      await tx`delete from alumni_photo where alumni_id = ${record.id}`;
    }
    await tx`
      insert into alumni_photo (path, alumni_id, webp, jpeg, width, height, source_type, source_bytes)
      values (${path}, ${record.id}, ${webp}, ${jpeg}, ${width}, ${height}, ${sourceType}, ${sourceBytes})
    `;
    await tx`
      update alumni
         set photo_path = ${path}, photo_status = 'live', photo_updated_at = now(), owner_updated_at = now()
       where id = ${record.id}
    `;
  });

  await audit(
    {
      actorType: 'alumnus',
      actorId: record.id,
      action: 'photo_uploaded',
      targetType: 'alumni',
      targetId: record.id,
      meta: { source_type: sourceType, source_bytes: sourceBytes, replaced: record.photo_path !== null },
    },
    sql,
  );

  return { ok: true, status: 'live' };
}

/** Remove a photograph. Erasure under the DPDP Act covers photographs (plan §11). */
export async function removeOwnPhoto(session: Session, sql: Sql = db()): Promise<boolean> {
  const rows = await sql<Array<{ id: string }>>`
    select id from alumni where gmail_hmac = ${session.emailHmac} limit 1
  `;
  const record = rows[0];
  if (!record) return false;

  await sql.begin(async (tx) => {
    await tx`delete from alumni_photo where alumni_id = ${record.id}`;
    await tx`
      update alumni
         set photo_path = null, photo_status = 'none', photo_updated_at = now(), owner_updated_at = now()
       where id = ${record.id}
    `;
  });

  await audit(
    { actorType: 'alumnus', actorId: record.id, action: 'photo_removed', targetType: 'alumni', targetId: record.id },
    sql,
  );
  return true;
}

export interface PhotoBytes {
  body: Buffer;
  contentType: 'image/webp' | 'image/jpeg';
  /** True when anyone may see it, which decides how long it can be cached. */
  isPublic: boolean;
}

/**
 * Serve one photograph, if this viewer may have it.
 *
 * The audience decision is `photoUrlFor` — the same function the card and the
 * profile page use — so there is one answer to "who may see this image" rather
 * than two that can drift.
 *
 * `ownerId` exists so the owner always sees their own image, whatever the
 * audience setting says. Everyone else is subject to it.
 */
export async function readPhotoBytes(
  alumniId: string,
  viewer: ViewerTier,
  rendition: 'webp' | 'jpeg',
  ownerId: string | null,
  sql: Sql = db(),
): Promise<PhotoBytes | null> {
  const rows = await sql<
    Array<{ id: string; photo_audience: string; photo_status: string; webp: Buffer; jpeg: Buffer }>
  >`
    select a.id, a.photo_audience, a.photo_status, p.webp, p.jpeg
      from alumni a
      join alumni_photo p on p.alumni_id = a.id
     where a.id = ${alumniId} and a.is_visible
     limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const isOwner = ownerId !== null && ownerId === row.id;

  if (!isOwner) {
    const url = photoUrlFor(
      {
        id: row.id,
        fullName: '',
        batchYear: 0,
        stream: null,
        currentOrg: null,
        designation: null,
        photoAudience: row.photo_audience as PhotoAudience,
        photoStatus: row.photo_status as OwnAlumnus['photoStatus'],
      },
      viewer,
    );
    if (url === null) return null;
  }

  return {
    body: rendition === 'webp' ? row.webp : row.jpeg,
    contentType: rendition === 'webp' ? 'image/webp' : 'image/jpeg',
    isPublic: row.photo_audience === 'public' && row.photo_status === 'live',
  };
}

/** The alumni id behind a session, for the owner check above. Null when there is no record. */
export async function ownAlumniId(session: Session | null, sql: Sql = db()): Promise<string | null> {
  if (!session) return null;
  const rows = await sql<Array<{ id: string }>>`
    select id from alumni where gmail_hmac = ${session.emailHmac} limit 1
  `;
  return rows[0]?.id ?? null;
}
