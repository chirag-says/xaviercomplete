/**
 * Encrypting on this machine and pushing ciphertext to Postgres.
 *
 * This is the only place in the ingest tool that writes. Everything before it
 * is a pure function over a spreadsheet; everything here happens inside one
 * transaction, so a failure halfway leaves the database exactly as it was.
 *
 * Plaintext exists in this process's memory and nowhere else. What crosses the
 * wire is AES-256-GCM ciphertext over TLS.
 *
 * Note on the schema: there is no `key_version` column on `alumni`. The version
 * byte is the first byte of every blob, which is strictly better — mid-rotation,
 * two fields of the same row can legitimately be at different versions, and a
 * single row-level column cannot express that.
 */

import type { Sql } from '../../src/lib/db.ts';
import { encryptOptional, fieldContext } from '../../src/lib/core/crypto.ts';
import { blindIndexOfNormalised } from '../../src/lib/core/hmac.ts';
import { OWNER_FIELDS, toggleDefaults, type Action, type ImportPlan } from './plan.ts';
import type { ValidRow } from './validate.ts';

export interface PushResult {
  inserted: number;
  updated: number;
  grantsAdded: number;
  /** Addresses already on the allowlist, including ones an admin had revoked. */
  grantsLeftAlone: number;
}

/** Which encrypted column holds which field. */
const ENCRYPTED_COLUMN = {
  contact: 'contact_enc',
  gmail: 'gmail_enc',
  formEmail: 'form_email_enc',
  otherInfo: 'other_info_enc',
} as const;

const PLAIN_COLUMN = {
  fullName: 'full_name',
  batchYear: 'batch_year',
  stream: 'stream',
  currentOrg: 'current_org',
  designation: 'designation',
  previousRole: 'previous_role',
} as const;

function encryptedFieldsFor(id: string, row: ValidRow): Record<string, Buffer | null> {
  const out: Record<string, Buffer | null> = {};
  for (const [field, column] of Object.entries(ENCRYPTED_COLUMN) as Array<
    [keyof typeof ENCRYPTED_COLUMN, string]
  >) {
    out[column] = encryptOptional(row[field], fieldContext('alumni', id, field));
  }
  return out;
}

function insertRecord(action: Extract<Action, { kind: 'insert' }>) {
  const { id, row } = action;
  const toggles = toggleDefaults(row);

  return {
    id,
    full_name: row.fullName,
    batch_year: row.batchYear,
    stream: row.stream,
    current_org: row.currentOrg,
    designation: row.designation,
    previous_role: row.previousRole,
    ...encryptedFieldsFor(id, row),
    gmail_hmac: row.gmail ? blindIndexOfNormalised(row.gmail) : null,
    show_contact: toggles.showContact,
    show_gmail: toggles.showGmail,
    // The Timestamp column is the per-record consent timestamp: the moment this
    // person submitted the form that disclosed alumni-visible use (plan §11).
    consent_recorded_at: row.submittedAt,
    submitted_at: row.submittedAt,
  };
}

/**
 * Build the partial update for a changed row.
 *
 * Only the fields in `changes` are written. Anything the alumnus has taken
 * ownership of was already moved to `skipped` by buildPlan and never reaches here.
 */
function updatePatch(action: Extract<Action, { kind: 'update' }>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const change of action.changes) {
    const field = change.field;
    if (field in PLAIN_COLUMN) {
      patch[PLAIN_COLUMN[field as keyof typeof PLAIN_COLUMN]] = change.to;
      continue;
    }
    if (field in ENCRYPTED_COLUMN) {
      const column = ENCRYPTED_COLUMN[field as keyof typeof ENCRYPTED_COLUMN];
      patch[column] = encryptOptional(
        change.to === null ? null : String(change.to),
        fieldContext('alumni', action.id, field),
      );
      if (field === 'gmail' && change.to) {
        patch.gmail_hmac = blindIndexOfNormalised(String(change.to));
      }
      // A newly supplied number may turn the contact toggle on, but only for a
      // record whose owner has never touched it — otherwise the toggle is theirs.
      if (field === 'contact' && change.to && action.skipped.length === 0) {
        patch.show_contact = true;
      }
    }
  }

  return patch;
}

export async function applyPlan(sql: Sql, plan: ImportPlan): Promise<PushResult> {
  const result: PushResult = { inserted: 0, updated: 0, grantsAdded: 0, grantsLeftAlone: 0 };

  await sql.begin(async (tx) => {
    for (const action of plan.actions) {
      if (action.kind === 'insert') {
        const record = insertRecord(action);
        await tx`insert into alumni ${tx(record)}`;
        result.inserted++;
      } else if (action.kind === 'update') {
        const patch = updatePatch(action);
        if (Object.keys(patch).length > 0) {
          await tx`update alumni set ${tx(patch)} where id = ${action.id}`;
          result.updated++;
        }
      }
    }

    // The allowlist. `do nothing` on conflict is deliberate: if an admin has
    // revoked someone's access, re-running the import must not quietly restore
    // it. A spreadsheet does not outrank a decision a person made.
    for (const email of plan.newGrants) {
      const inserted = await tx`
        insert into access_grant (email_hmac, source)
        values (${blindIndexOfNormalised(email)}, 'import')
        on conflict (email_hmac) do nothing
        returning id
      `;
      if (inserted.length > 0) result.grantsAdded++;
      else result.grantsLeftAlone++;
    }

    // Counts only. An audit row that names the people it describes is a leak.
    await tx`
      insert into audit_log (actor_type, actor_id, action, target_type, meta)
      values ('system', 'ingest', 'alumni_import', 'alumni', ${tx.json({
        inserted: result.inserted,
        updated: result.updated,
        unchanged: plan.counts.unchanged,
        skipped_owner_fields: plan.counts.skippedFields,
        grants_added: result.grantsAdded,
        grants_left_alone: result.grantsLeftAlone,
        rows_without_login: plan.withoutLogin,
      })})
    `;
  });

  return result;
}

/**
 * Load the current directory so the plan can diff against it.
 *
 * Decrypts in this process, which is fine: the ingest tool holds the key by
 * definition. `owner_updated_at` is what tells the planner to leave a
 * self-edited profile alone.
 */
export async function loadExisting(sql: Sql, decrypt: (blob: Buffer | null, id: string, field: string) => string | null) {
  const rows = await sql<
    Array<{
      id: string;
      full_name: string;
      batch_year: number;
      stream: string | null;
      current_org: string | null;
      designation: string | null;
      previous_role: string | null;
      contact_enc: Buffer | null;
      gmail_enc: Buffer | null;
      form_email_enc: Buffer | null;
      other_info_enc: Buffer | null;
      gmail_hmac: Buffer | null;
      owner_updated_at: Date | null;
    }>
  >`
    select id, full_name, batch_year, stream, current_org, designation, previous_role,
           contact_enc, gmail_enc, form_email_enc, other_info_enc, gmail_hmac, owner_updated_at
    from alumni
  `;

  return rows.map((row) => ({
    id: row.id,
    loginHmacHex: row.gmail_hmac ? Buffer.from(row.gmail_hmac).toString('hex') : `no-login:${row.id}`,
    fullName: row.full_name,
    batchYear: row.batch_year,
    stream: row.stream,
    currentOrg: row.current_org,
    designation: row.designation,
    previousRole: row.previous_role,
    contact: decrypt(row.contact_enc, row.id, 'contact'),
    gmail: decrypt(row.gmail_enc, row.id, 'gmail'),
    formEmail: decrypt(row.form_email_enc, row.id, 'formEmail'),
    otherInfo: decrypt(row.other_info_enc, row.id, 'otherInfo'),
    ownerUpdatedAt: row.owner_updated_at,
  }));
}

export { OWNER_FIELDS };
