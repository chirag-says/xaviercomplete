/**
 * Creating alumni records from the portal.
 *
 * Until migration 0010 a record could only come from the spreadsheet, where the
 * Google Form's Timestamp column carries the consent evidence. An administrator
 * adding somebody by hand has no such column — so `consentNote` is **required**
 * here, and the form asks where the consent can be found rather than offering a
 * tickbox. Publishing a named person's employer and contact details with no
 * record of why the Association may do so is the one thing this module exists
 * to prevent.
 *
 * Shared by the single-record form and the spreadsheet upload, so "create an
 * alumnus" has one implementation. A second one would be a second place to
 * forget the consent note, the blind index, or the AAD.
 */

import { adminDb, type Sql } from './db.ts';
import {
  audit,
  blindIndexOfNormalised,
  encryptOptional,
  fieldContext,
  newAlumniId,
  normaliseEmail,
  normalisePhone,
} from './shared.ts';

/** The fields an administrator supplies. Everything else is derived or defaulted. */
export interface NewAlumnus {
  fullName: string;
  batchYear: number;
  stream: string | null;
  currentOrg: string | null;
  designation: string | null;
  previousRole: string | null;
  /** As typed. Normalised to E.164 here, or refused. */
  contact: string | null;
  /** The sign-in identity. Optional — a record without one is listed but cannot sign in. */
  email: string | null;
  otherInfo: string | null;
  /** Where the consent for this record can be found. Required. */
  consentNote: string;
  /** When consent was given. Defaults to now if the administrator does not know. */
  consentAt: Date;
}

export type CreateOutcome =
  | { ok: true; id: string }
  | { ok: false; field: keyof NewAlumnus | 'duplicate'; message: string };

const LIMITS = {
  fullName: 120,
  stream: 120,
  currentOrg: 200,
  designation: 200,
  previousRole: 400,
  otherInfo: 2000,
  consentNote: 500,
} as const;

function clamp(value: string | null, max: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
}

/**
 * Validate without touching the database.
 *
 * Split out so the spreadsheet upload can show a dry-run preview — "these
 * eleven rows will be created, these two are wrong and why" — before anything
 * is written.
 */
export function validateNewAlumnus(
  input: NewAlumnus,
): { ok: true; clean: NewAlumnus & { contact: string | null; email: string | null } } | { ok: false; field: keyof NewAlumnus; message: string } {
  const fullName = clamp(input.fullName, LIMITS.fullName);
  if (!fullName) {
    return { ok: false, field: 'fullName', message: 'A name is required.' };
  }

  if (!Number.isInteger(input.batchYear) || input.batchYear < 1900 || input.batchYear > 2100) {
    return { ok: false, field: 'batchYear', message: 'Batch year must be a four-digit year between 1900 and 2100.' };
  }

  // A number that cannot be normalised is refused rather than stored as typed.
  // The directory is only useful if the numbers in it can be dialled.
  let contact: string | null = null;
  if (input.contact && input.contact.trim() !== '') {
    const parsed = normalisePhone(input.contact);
    if (!parsed.ok) {
      return {
        ok: false,
        field: 'contact',
        message: 'That does not look like a phone number we can store. Include the country code, e.g. +91 98765 43210.',
      };
    }
    contact = parsed.value;
  }

  let email: string | null = null;
  if (input.email && input.email.trim() !== '') {
    const parsed = normaliseEmail(input.email);
    if (!parsed.ok || !parsed.value) {
      return { ok: false, field: 'email', message: 'That is not a usable email address.' };
    }
    email = parsed.value;
  }

  const consentNote = clamp(input.consentNote, LIMITS.consentNote);
  if (!consentNote) {
    return {
      ok: false,
      field: 'consentNote',
      message:
        'Say where the consent for this record can be found — a signed form, an email, a conversation. Without it the Association has no evidence it may publish these details.',
    };
  }

  return {
    ok: true,
    clean: {
      ...input,
      fullName,
      contact,
      email,
      stream: clamp(input.stream, LIMITS.stream),
      currentOrg: clamp(input.currentOrg, LIMITS.currentOrg),
      designation: clamp(input.designation, LIMITS.designation),
      previousRole: clamp(input.previousRole, LIMITS.previousRole),
      otherInfo: clamp(input.otherInfo, LIMITS.otherInfo),
      consentNote,
    },
  };
}

/**
 * Write one record.
 *
 * ## The toggle defaults match the import's
 *
 * `show_contact` follows whether a number was actually supplied; `show_gmail`
 * defaults on. Same rule as the spreadsheet path (plan §4.2 step 5) — a default
 * derived from what the person gave us, never from an assumption. The alumnus
 * owns both from the moment they first sign in.
 *
 * ## `owner_updated_at` stays null
 *
 * Deliberately. It marks fields an alumnus has taken ownership of, and an
 * administrator typing a record in has not done that on their behalf. Leaving
 * it null means a later spreadsheet import can still correct this record, which
 * is usually what you want for a hand-entered row.
 */
export async function createAlumnus(
  input: NewAlumnus,
  adminId: string,
  sql: Sql = adminDb(),
): Promise<CreateOutcome> {
  const validated = validateNewAlumnus(input);
  if (!validated.ok) return validated;
  const clean = validated.clean;

  const id = newAlumniId();
  const emailHmac = clean.email ? blindIndexOfNormalised(clean.email) : null;

  // Checked before the insert so the administrator gets a sentence rather than
  // a unique-constraint violation. The constraint is still the real guard — two
  // simultaneous adds would race past this check and one would lose there.
  if (emailHmac) {
    const clash = await sql<Array<{ id: string; full_name: string }>>`
      select id, full_name from alumni where gmail_hmac = ${emailHmac} limit 1
    `;
    if (clash[0]) {
      return {
        ok: false,
        field: 'duplicate',
        message: `That email address already belongs to ${clash[0].full_name}. One address, one record.`,
      };
    }
  }

  try {
    await sql`
      insert into alumni (
        id, full_name, batch_year, stream, current_org, designation, previous_role,
        contact_enc, gmail_enc, gmail_hmac, other_info_enc,
        show_contact, show_gmail,
        consent_recorded_at, consent_note, added_by
      ) values (
        ${id}, ${clean.fullName}, ${clean.batchYear}, ${clean.stream}, ${clean.currentOrg},
        ${clean.designation}, ${clean.previousRole},
        ${encryptOptional(clean.contact, fieldContext('alumni', id, 'contact'))},
        ${encryptOptional(clean.email, fieldContext('alumni', id, 'gmail'))},
        ${emailHmac},
        ${encryptOptional(clean.otherInfo, fieldContext('alumni', id, 'otherInfo'))},
        ${clean.contact !== null},
        ${clean.email !== null},
        ${clean.consentAt}, ${clean.consentNote}, ${adminId}
      )
    `;
  } catch (error) {
    // The unique index on gmail_hmac is the race the check above cannot close.
    if ((error as { code?: string }).code === '23505') {
      return { ok: false, field: 'duplicate', message: 'That email address already belongs to another record.' };
    }
    throw error;
  }

  // Ids and flags. Never a name, never a number — the audit log must not become
  // a second copy of the directory.
  await audit(
    {
      actorType: 'admin',
      actorId: adminId,
      action: 'alumni_created',
      targetType: 'alumni',
      targetId: id,
      meta: { has_login: emailHmac !== null, has_contact: clean.contact !== null, via: 'portal' },
    },
    sql,
  );

  return { ok: true, id };
}

/**
 * Put a hand-added alumnus on the sign-in allowlist.
 *
 * Kept separate from `createAlumnus` because they are different decisions.
 * Adding a record publishes somebody's name and employer; granting access lets
 * them read five hundred people's contact details. The portal asks for both
 * explicitly and requires step-up for this half.
 */
export async function grantAlumnusAccess(
  alumniId: string,
  adminId: string,
  sql: Sql = adminDb(),
): Promise<boolean> {
  const rows = await sql<Array<{ gmail_hmac: Buffer | null }>>`
    select gmail_hmac from alumni where id = ${alumniId} limit 1
  `;
  const hmac = rows[0]?.gmail_hmac;
  if (!hmac) return false;

  await sql`
    insert into access_grant (email_hmac, source, granted_by, granted_at)
    values (${hmac}, 'admin_grant', ${adminId}, now())
    on conflict (email_hmac) do update
       set revoked_at = null, granted_by = ${adminId}, granted_at = now(), source = 'admin_grant'
  `;

  await audit(
    { actorType: 'admin', actorId: adminId, action: 'access_granted', targetType: 'alumni', targetId: alumniId },
    sql,
  );
  return true;
}
