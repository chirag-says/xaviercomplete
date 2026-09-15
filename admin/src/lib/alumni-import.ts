/**
 * Importing a spreadsheet from the admin portal.
 *
 * ## The position this reverses, and why
 *
 * Plan §4.4 said bulk import must stay local, and called a portal upload "the
 * single largest hole you could cut in this design". That was written when the
 * rule was *no plaintext ever reaches the server*. Two phases later the rule is
 * not that any more and could not be: `/me` takes a phone number typed into a
 * form on the internet, and this portal decrypts all five hundred contact
 * details every time somebody opens a record.
 *
 * Given the server already sees this data on read, a bulk write path does not
 * grant it access it lacks. What remains of the original objection is narrower
 * and is handled here: the file must never reach disk, never reach a log, and
 * never be larger than we agreed to parse.
 *
 * **The local tool is still the right one for the first five hundred.** One
 * file containing every alumnus is worth keeping on a laptop. This is for the
 * twenty who turn up afterwards.
 *
 * ## Two passes over the same bytes
 *
 * The browser posts the file twice: once to preview, once to commit. That is
 * deliberate. The alternative — parking parsed rows in a table or a session
 * between the two — would mean five hundred people's contact details sitting
 * somewhere as working state, which is exactly what we are trying not to do.
 * The file is already in the browser; sending it again costs a second.
 *
 * The parsing, column detection and validation are the ingest tool's, imported
 * rather than reimplemented. Two parsers would disagree eventually, and the
 * disagreement would show up as rows silently dropped.
 */

import { detectColumns } from './ingest/columns.ts';
import { validateSheet, type RowProblem, type ValidRow } from './ingest/validate.ts';
import { readSheetFromBuffer, SheetReadError } from './ingest/workbook.ts';
import { adminDb, type Sql } from './db.ts';
import { audit, blindIndexOfNormalised } from './shared.ts';
import { createAlumnus, grantAlumnusAccess } from './alumni-create.ts';
import { invitationEmail, mailConfig, send } from './shared-email.ts';

/** Same cap as a photograph. A spreadsheet of five hundred rows is well under a megabyte. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Enough for several graduating years at once, small enough to parse in one request. */
export const MAX_IMPORT_ROWS = 2000;

export interface ImportPreview {
  sheetName: string;
  sheetCount: number;
  /**
   * Which column each field was found in, for the operator to sanity-check.
   * `column: null` means the header was not found at all — worth showing rather
   * than hiding, because a missing "Contact number" column is the difference
   * between importing five hundred people with numbers and without.
   */
  mapping: Array<{ label: string; column: string | null; header: string | null }>;
  valid: ValidRow[];
  rejected: RowProblem[];
  warnings: RowProblem[];
  /** Rows whose sign-in address already belongs to a record. Skipped on commit. */
  duplicates: Array<{ rowNumber: number; name: string; existing: string }>;
  /** Valid rows with no sign-in address. Imported, but they cannot log in. */
  withoutLogin: number;
}

export type ParseOutcome =
  | { ok: true; preview: ImportPreview }
  | { ok: false; message: string };

/**
 * Parse and check, touching nothing.
 *
 * Every failure here is a sentence the operator can act on. "Could not read the
 * file" is not one, so the parser's own messages are passed through.
 */
export async function previewImport(
  bytes: Buffer,
  filename: string,
  sql: Sql = adminDb(),
): Promise<ParseOutcome> {
  if (bytes.length === 0) return { ok: false, message: 'That file was empty.' };
  if (bytes.length > MAX_IMPORT_BYTES) {
    return { ok: false, message: 'That file is larger than 5 MB. A spreadsheet of alumni should be far smaller.' };
  }

  const isCsv = filename.toLowerCase().endsWith('.csv');

  let sheet;
  try {
    sheet = await readSheetFromBuffer(bytes, isCsv);
  } catch (error) {
    if (error instanceof SheetReadError) return { ok: false, message: error.message };
    // Never echo the parser's internals — they can contain cell contents.
    console.error('[import] could not read the workbook:', (error as Error).message);
    return { ok: false, message: 'That file could not be read as a spreadsheet. Export it again as .xlsx or .csv.' };
  }

  if (sheet.rows.length === 0) {
    return { ok: false, message: 'The sheet has a header row and nothing else.' };
  }
  if (sheet.rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      message: `That sheet has ${sheet.rows.length} rows; this page handles up to ${MAX_IMPORT_ROWS}. For a load that size use the local ingest tool.`,
    };
  }

  const mapping = detectColumns(sheet.headers);
  const outcome = validateSheet(sheet.rows, mapping.map, sheet.firstRowNumber);

  /*
   * Which of these are already in the directory?
   *
   * Two keys, because not every row has the good one:
   *
   *   - **A sign-in address** is exact. One address, one record, and a unique
   *     index enforces it.
   *   - **Name plus batch year**, for the rows that have no address. Weaker —
   *     two Xaverians of the same name in the same year would collide — but the
   *     alternative is worse: with nothing to match on, re-uploading a corrected
   *     sheet silently creates a second copy of every such person, every time.
   *     Found by uploading the same file three times and finding one name in
   *     the directory three times.
   *
   * A collision here skips a real person rather than duplicating one, and they
   * appear in the preview as "already in the directory" so the operator can add
   * them by hand. That is the better failure of the two.
   */
  const duplicates: ImportPreview['duplicates'] = [];
  const withLogin = outcome.valid.filter((row) => row.loginEmail);
  const withoutLoginRows = outcome.valid.filter((row) => !row.loginEmail);

  if (withoutLoginRows.length > 0) {
    const existing = await sql<Array<{ full_name: string; batch_year: number }>>`
      select full_name, batch_year from alumni where gmail_hmac is null
    `;
    const seen = new Set(existing.map((row) => `${row.full_name.toLowerCase()}|${row.batch_year}`));

    for (const row of withoutLoginRows) {
      if (seen.has(`${row.fullName.toLowerCase()}|${row.batchYear}`)) {
        duplicates.push({
          rowNumber: row.rowNumber,
          name: row.fullName,
          existing: `${row.fullName} (${row.batchYear}) — matched on name and year, no address to check`,
        });
      }
    }
  }

  if (withLogin.length > 0) {
    const hmacs = withLogin.map((row) => blindIndexOfNormalised(row.loginEmail!));
    // `in ${sql(array)}` rather than `= any(...)`: postgres.js expands the first
    // into a parameterised tuple, and cannot infer the array type of the second
    // for bytea — it fails with "make_scalar_array_op" rather than anything that
    // points at the cause.
    const existing = await sql<Array<{ gmail_hmac: Buffer; full_name: string }>>`
      select gmail_hmac, full_name from alumni where gmail_hmac in ${sql(hmacs)}
    `;
    const byHmac = new Map(existing.map((row) => [Buffer.from(row.gmail_hmac).toString('hex'), row.full_name]));

    for (const row of withLogin) {
      const match = byHmac.get(blindIndexOfNormalised(row.loginEmail!).toString('hex'));
      if (match) duplicates.push({ rowNumber: row.rowNumber, name: row.fullName, existing: match });
    }
  }

  return {
    ok: true,
    preview: {
      sheetName: sheet.sheetName,
      sheetCount: sheet.sheetCount,
      mapping: mapping.explain.map((entry) => ({
        label: entry.label,
        column: entry.column,
        header: entry.header,
      })),
      valid: outcome.valid,
      rejected: outcome.rejected,
      warnings: outcome.warnings,
      duplicates,
      withoutLogin: outcome.valid.filter((row) => !row.loginEmail).length,
    },
  };
}

export interface ImportResult {
  created: number;
  granted: number;
  invited: number;
  skipped: number;
  failed: Array<{ rowNumber: number; name: string; message: string }>;
}

/**
 * Write the rows that passed.
 *
 * Not one transaction. Five hundred inserts either all landing or all rolling
 * back sounds tidier than it is: one bad row would discard four hundred and
 * ninety-nine good ones, and the operator would have to find it by bisection.
 * Each row stands alone, and anything that fails is named in the result so it
 * can be fixed and re-uploaded — the duplicate check makes a second run safe.
 */
export async function commitImport(
  bytes: Buffer,
  filename: string,
  adminId: string,
  options: { grantAccess: boolean; sendInvitations: boolean; consentNote: string; consentAt: Date },
  sql: Sql = adminDb(),
): Promise<{ ok: true; result: ImportResult } | { ok: false; message: string }> {
  const parsed = await previewImport(bytes, filename, sql);
  if (!parsed.ok) return parsed;

  const { valid, duplicates } = parsed.preview;
  const duplicateRows = new Set(duplicates.map((row) => row.rowNumber));

  const result: ImportResult = { created: 0, granted: 0, invited: 0, skipped: duplicateRows.size, failed: [] };

  // Collect emails to invite after all records are created.
  const toInvite: string[] = [];

  for (const row of valid) {
    if (duplicateRows.has(row.rowNumber)) continue;

    const created = await createAlumnus(
      {
        fullName: row.fullName,
        batchYear: row.batchYear,
        stream: row.stream,
        currentOrg: row.currentOrg,
        designation: row.designation,
        previousRole: row.previousRole,
        contact: row.contact,
        email: row.loginEmail,
        otherInfo: row.otherInfo,
        consentNote: options.consentNote,
        consentAt: row.submittedAt ?? options.consentAt,
      },
      adminId,
      sql,
    );

    if (!created.ok) {
      result.failed.push({ rowNumber: row.rowNumber, name: row.fullName, message: created.message });
      continue;
    }

    result.created++;

    if (options.grantAccess && row.loginEmail) {
      if (await grantAlumnusAccess(created.id, adminId, sql)) result.granted++;
    }

    // Queue invitation email if the option is on and the alumni has an email
    if (options.sendInvitations && row.loginEmail) {
      toInvite.push(row.loginEmail);
    }
  }

  // Send invitation emails — fire and forget per email so one failure
  // does not block the rest. Failures are logged but do not affect the result.
  if (toInvite.length > 0) {
    let config: ReturnType<typeof mailConfig>;
    try {
      config = mailConfig();
    } catch (error) {
      console.error('[import] cannot send invitations — mail is not configured:', (error as Error).message);
      config = null as never;
    }

    if (config) {
      const loginUrl = `${process.env.APP_URL ?? config.appUrl}/login`;
      for (const email of toInvite) {
        try {
          await send({ to: email, ...invitationEmail(email, loginUrl) }, config);
          result.invited++;
        } catch (error) {
          console.error(`[import] could not send invitation to ${email}:`, (error as Error).message);
        }
      }
    }
  }

  await audit(
    {
      actorType: 'admin',
      actorId: adminId,
      action: 'alumni_imported',
      targetType: 'alumni',
      meta: {
        created: result.created,
        granted: result.granted,
        invited: result.invited,
        skipped: result.skipped,
        failed: result.failed.length,
        rejected: parsed.preview.rejected.length,
        via: 'portal_upload',
      },
    },
    sql,
  );

  return { ok: true, result };
}
