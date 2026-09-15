/**
 * Working out what the import would actually do, before it does it.
 *
 * Pure: existing records in, actions out. No database, no encryption, no I/O —
 * which is what makes the interesting rule below testable.
 *
 * ## The rule that matters
 *
 * Once an alumnus has edited their own profile (`owner_updated_at` is set),
 * a re-import must not overwrite what they changed. If the Association loads a
 * refreshed sheet in 2027, someone who corrected their employer on /me in 2026
 * should not silently have the stale spreadsheet value put back. Their fields
 * are reported as skipped rather than quietly dropped, so the operator can see
 * the divergence and decide.
 */

import type { ValidRow } from './validate.ts';

/** An existing row, already decrypted by the caller (the ingest tool holds the key). */
export interface ExistingRecord {
  id: string;
  /** Hex of gmail_hmac, for matching. */
  loginHmacHex: string;
  fullName: string;
  batchYear: number;
  stream: string | null;
  currentOrg: string | null;
  designation: string | null;
  previousRole: string | null;
  contact: string | null;
  gmail: string | null;
  formEmail: string | null;
  otherInfo: string | null;
  ownerUpdatedAt: Date | null;
}

/** Fields the alumnus owns once they have touched their profile (plan §7.1). */
export const OWNER_FIELDS = ['contact', 'currentOrg', 'designation', 'previousRole', 'otherInfo'] as const;
/** Fields the spreadsheet remains the source of truth for. */
export const IMPORT_FIELDS = ['fullName', 'batchYear', 'stream', 'gmail', 'formEmail'] as const;

export type ComparableField = (typeof OWNER_FIELDS)[number] | (typeof IMPORT_FIELDS)[number];

export interface FieldChange {
  field: ComparableField;
  /** Raw values. Held in this process only; the preview masks them before display. */
  from: string | number | null;
  to: string | number | null;
}

export type Action =
  | { kind: 'insert'; id: string; row: ValidRow }
  | { kind: 'update'; id: string; row: ValidRow; changes: FieldChange[]; skipped: FieldChange[] }
  | { kind: 'unchanged'; id: string; row: ValidRow };

export interface ImportPlan {
  actions: Action[];
  counts: { insert: number; update: number; unchanged: number; skippedFields: number };
  /** Login addresses that will be added to the allowlist. Hashed by the caller. */
  newGrants: string[];
  /** Rows whose person cannot sign in: no usable address in either column. */
  withoutLogin: number;
}

function valueOf(row: ValidRow, field: ComparableField): string | number | null {
  return row[field] ?? null;
}

function existingValueOf(record: ExistingRecord, field: ComparableField): string | number | null {
  return record[field] ?? null;
}

/**
 * Build the plan.
 *
 * @param rows        validated sheet rows
 * @param existing    current database rows, keyed by hex gmail_hmac
 * @param hmacHexOf   how to derive the login index for a row (injected so this stays pure)
 * @param mintId      how to make a new alumni id (injected so tests are deterministic)
 */
export function buildPlan(
  rows: ValidRow[],
  existing: Map<string, ExistingRecord>,
  hmacHexOf: (loginEmail: string) => string,
  mintId: () => string,
): ImportPlan {
  const actions: Action[] = [];
  const newGrants: string[] = [];
  let skippedFields = 0;
  let withoutLogin = 0;

  for (const row of rows) {
    if (!row.loginEmail) withoutLogin++;

    const key = row.loginEmail ? hmacHexOf(row.loginEmail) : null;
    const match = key ? existing.get(key) : undefined;

    if (!match) {
      actions.push({ kind: 'insert', id: mintId(), row });
      if (row.loginEmail) newGrants.push(row.loginEmail);
      continue;
    }

    const ownerHasEdited = match.ownerUpdatedAt !== null;
    const changes: FieldChange[] = [];
    const skipped: FieldChange[] = [];

    for (const field of [...IMPORT_FIELDS, ...OWNER_FIELDS] as ComparableField[]) {
      const to = valueOf(row, field);
      const from = existingValueOf(match, field);
      if (from === to) continue;

      // A blank cell in a refreshed sheet is an absence of information, not an
      // instruction to erase what we already hold. Only non-empty values overwrite.
      if (to === null) continue;

      const isOwned = (OWNER_FIELDS as readonly string[]).includes(field);
      if (ownerHasEdited && isOwned) {
        skipped.push({ field, from, to });
      } else {
        changes.push({ field, from, to });
      }
    }

    skippedFields += skipped.length;

    if (changes.length === 0 && skipped.length === 0) {
      actions.push({ kind: 'unchanged', id: match.id, row });
    } else {
      actions.push({ kind: 'update', id: match.id, row, changes, skipped });
    }
  }

  return {
    actions,
    counts: {
      insert: actions.filter((a) => a.kind === 'insert').length,
      update: actions.filter((a) => a.kind === 'update').length,
      unchanged: actions.filter((a) => a.kind === 'unchanged').length,
      skippedFields,
    },
    newGrants,
    withoutLogin,
  };
}

/**
 * Toggle defaults, set once at import and owned by the alumnus from then on
 * (plan §1.3, §4.2 step 5).
 *
 * The defaults come from what the person actually supplied on the form, never
 * from an assumption: they gave a number under a form that disclosed
 * alumni-visible use, so ON is honest; they left it blank, so OFF is honest.
 *
 * `showGmail` is forced false without a Gmail because the database constraint
 * `show_gmail_needs_a_gmail` refuses a toggle that promises a field the row
 * does not have.
 */
export function toggleDefaults(row: ValidRow): { showContact: boolean; showGmail: boolean } {
  return {
    showContact: row.contact !== null,
    showGmail: row.gmail !== null,
  };
}
