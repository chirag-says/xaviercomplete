/**
 * Loading alumni records, and the only place a viewer tier is decided.
 *
 * **Server only.** This module reads the database and the encryption key. It
 * imports `./db.ts` and `./core/crypto.ts`, both of which pull in Node built-ins,
 * so importing it from a component marked `'use client'` fails the build rather
 * than shipping a decryption key to a browser. That build error is the
 * enforcement; the comment is only here to explain it.
 *
 * ## The shape of the guarantee
 *
 * Two functions, two tiers, and no way to cross between them:
 *
 *   - `listPublicAlumni` selects eight columns. `contact_enc` is not among
 *     them, so the grid cannot leak a number it never loaded.
 *   - `readProfile` selects everything and decrypts — and takes a `Session`,
 *     not an id and a boolean. A caller with no session has nothing to pass,
 *     which is a compile error rather than a forgotten `if`.
 *
 * The session itself is resolved from the cookie by `currentSession()` and
 * nowhere else, so no route can name a viewer other than the one asking.
 */

import { decryptOptional, fieldContext, CryptoIntegrityError } from './core/crypto.ts';
import { isAlumniId } from './core/ids.ts';
import { db, type Sql } from './db.ts';
import type { Session } from './session.ts';
import {
  toPrivate,
  toPublic,
  type AlumniRecord,
  type PrivateAlumnus,
  type PublicAlumnus,
  type PublicRow,
  type ViewerTier,
} from './visibility.ts';

/**
 * Whether to serve the synthetic records in src/data/alumni.ts.
 *
 * Refused outright in production. A flag that silently swaps the real directory
 * for twelve invented people would be a strange kind of outage — the site would
 * look fine and be entirely wrong — so a misconfigured deploy stops instead.
 */
export function servingDemoRecords(): boolean {
  const flag = process.env.USE_DEMO_ALUMNI === 'true';
  if (flag && process.env.NODE_ENV === 'production') {
    throw new Error(
      'USE_DEMO_ALUMNI is true in production. The live site must not serve synthetic records; unset it and redeploy.',
    );
  }
  return flag;
}

/** The tier a viewer belongs to. The single point where a session becomes an authorisation. */
export function tierOf(session: Session | null): ViewerTier {
  return session ? 'verified' : 'anonymous';
}

// --- demo path ---------------------------------------------------------------

async function demoRecords(): Promise<AlumniRecord[]> {
  // Imported lazily so the synthetic records are not bundled into a production
  // build that will never reach this branch.
  const { demoAlumni } = await import('@/data/alumni');
  return demoAlumni;
}

// --- database path -----------------------------------------------------------

/**
 * Column list for the grid. Written once, used once, and deliberately not a
 * `select *` — a future migration that adds a confidential column must not
 * quietly start loading it here.
 */
interface PublicDbRow {
  id: string;
  full_name: string;
  batch_year: number;
  stream: string | null;
  current_org: string | null;
  designation: string | null;
  photo_audience: string;
  photo_status: string;
}

function toPublicRow(row: PublicDbRow): PublicRow {
  return {
    id: row.id,
    fullName: row.full_name,
    batchYear: row.batch_year,
    stream: row.stream,
    currentOrg: row.current_org,
    designation: row.designation,
    photoAudience: row.photo_audience as PublicRow['photoAudience'],
    photoStatus: row.photo_status as PublicRow['photoStatus'],
  };
}

/**
 * The directory grid, for either tier.
 *
 * `is_visible` is in the WHERE clause, not filtered afterwards: a record the
 * owner has withdrawn (plan §7.1) must never be loaded, not merely never
 * rendered. Ordering matches the `alumni_directory` index — newest batch first,
 * then alphabetical — so the query is an index scan rather than a sort.
 */
export async function listPublicAlumni(
  viewer: ViewerTier,
  sql: Sql = db(),
): Promise<PublicAlumnus[]> {
  const rows: PublicRow[] = servingDemoRecords()
    ? await demoRecords()
    : (
        await sql<PublicDbRow[]>`
          select id, full_name, batch_year, stream, current_org, designation,
                 photo_audience, photo_status
            from alumni
           where is_visible
           order by batch_year desc, full_name
        `
      ).map(toPublicRow);

  return rows.map((row) => toPublic(row, viewer));
}

/**
 * Decrypt one field, or give up on that field alone.
 *
 * A blob that will not authenticate is a real problem — a tampered row, a
 * mid-rotation key gap — but it is not a reason to 500 the whole profile. The
 * field is dropped, the profile renders as "not shared", and the operator sees
 * it in the log. Failing the page instead would turn one bad cell into an
 * outage and tell the user nothing they could act on.
 */
function decryptField(
  blob: Buffer | null,
  id: string,
  field: 'contact' | 'gmail' | 'otherInfo',
): string | null {
  try {
    return decryptOptional(blob, fieldContext('alumni', id, field));
  } catch (error) {
    if (error instanceof CryptoIntegrityError) {
      // The message names the cell, never the value.
      console.error(`[directory] ${field} on ${id} failed to decrypt: ${error.message}`);
      return null;
    }
    throw error;
  }
}

interface FullDbRow extends PublicDbRow {
  previous_role: string | null;
  contact_enc: Buffer | null;
  gmail_enc: Buffer | null;
  other_info_enc: Buffer | null;
  show_contact: boolean;
  show_gmail: boolean;
}

async function loadRecord(id: string, sql: Sql): Promise<AlumniRecord | null> {
  if (servingDemoRecords()) {
    return (await demoRecords()).find((record) => record.id === id) ?? null;
  }

  const rows = await sql<FullDbRow[]>`
    select id, full_name, batch_year, stream, current_org, designation,
           photo_audience, photo_status, previous_role,
           contact_enc, gmail_enc, other_info_enc, show_contact, show_gmail
      from alumni
     where id = ${id} and is_visible
     limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    ...toPublicRow(row),
    previousRole: row.previous_role,
    contact: decryptField(row.contact_enc, row.id, 'contact'),
    gmail: decryptField(row.gmail_enc, row.id, 'gmail'),
    otherInfo: decryptField(row.other_info_enc, row.id, 'otherInfo'),
    showContact: row.show_contact,
    showGmail: row.show_gmail,
  };
}

/**
 * One full profile, for a signed-in alumnus.
 *
 * The `session` parameter is required and unused beyond being required — which
 * is the point. It is a capability: holding one is the proof that
 * `currentSession()` returned something, and there is no overload without it.
 * A future caller who wants a profile must first obtain a session, and the only
 * way to obtain one is from the viewer's own cookie.
 *
 * The id is validated against the id alphabet before the query, so a probe like
 * `/alumni/../../etc` never reaches the database.
 */
export async function readProfile(
  id: string,
  session: Session,
  sql: Sql = db(),
): Promise<PrivateAlumnus | null> {
  void session;
  if (!isAlumniId(id)) return null;

  const record = await loadRecord(id, sql);
  return record ? toPrivate(record) : null;
}

/**
 * The handful of records the "Featured Xaverians" band shows.
 *
 * Public tier, like the grid: the band is above the fold on a page anonymous
 * visitors can see, so it renders the same five fields a card does.
 */
export async function listFeatured(
  viewer: ViewerTier,
  ids: string[],
  sql: Sql = db(),
): Promise<PublicAlumnus[]> {
  const everyone = await listPublicAlumni(viewer, sql);
  const byId = new Map(everyone.map((person) => [person.id, person]));
  const picked = ids.map((id) => byId.get(id)).filter((person): person is PublicAlumnus => Boolean(person));
  // A featured id that no longer matches a visible record leaves a gap rather
  // than an error; falling back keeps the band full while the list is corrected.
  return picked.length > 0 ? picked : everyone.slice(0, 3);
}
