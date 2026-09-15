/**
 * Row validation: one spreadsheet row in, one clean record or a list of reasons out.
 *
 * Nothing untyped reaches the database. Every value here is either normalised
 * into a canonical form or rejected with a reason the operator can act on, and
 * the reasons are deliberately specific — "row 213: batch_year — no plausible
 * year found in '2nd batch'" is fixable, "invalid row" is not.
 *
 * Rows are rejected, never repaired by guessing. A wrong phone number that got
 * through because the parser was clever is worse than a rejected row that
 * appears in the report.
 */

import { normaliseEmail } from '../../src/lib/core/email.ts';
import { normalisePhone } from '../../src/lib/core/phone.ts';
import type { ColumnMap, FieldKey } from './columns.ts';

/** A row that is safe to encrypt and store. */
export interface ValidRow {
  /** 1-based row number in the sheet, as the operator sees it in Excel. */
  rowNumber: number;
  fullName: string;
  batchYear: number;
  stream: string | null;
  currentOrg: string | null;
  designation: string | null;
  previousRole: string | null;
  /** E.164, or null when the alumnus declined or left it blank. */
  contact: string | null;
  /** Normalised; the address shown to other alumni and used for login. */
  gmail: string | null;
  /** Normalised; the address the form response came from. Admin-only. */
  formEmail: string | null;
  otherInfo: string | null;
  submittedAt: Date | null;
  /**
   * The address this person will log in with: column 10, falling back to
   * column 2. Null means they get a directory entry but no way in — which is a
   * warning, not an error, and is counted separately in the report.
   */
  loginEmail: string | null;
}

export interface RowProblem {
  rowNumber: number;
  field: FieldKey | 'row';
  reason: string;
}

export interface ValidationOutcome {
  valid: ValidRow[];
  rejected: RowProblem[];
  /** Rows that will import but need the operator's attention. */
  warnings: RowProblem[];
}

const MAX_LENGTHS: Partial<Record<FieldKey, number>> = {
  fullName: 120,
  stream: 120,
  currentOrg: 200,
  designation: 200,
  previousRole: 400,
  otherInfo: 4000,
};

/** Ways a respondent says "nothing here", beyond an empty cell. */
const BLANKISH = new Set(['', '-', '--', 'na', 'n/a', 'n.a', 'n.a.', 'nil', 'none', 'null', 'nan']);

function cellText(row: unknown[], index: number | undefined): string {
  if (index === undefined) return '';
  const value = row[index];
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    // exceljs hands back rich text and hyperlink objects for formatted cells.
    const maybe = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
    if (Array.isArray(maybe.richText)) return maybe.richText.map((part) => part.text ?? '').join('');
    if (typeof maybe.text === 'string') return maybe.text;
    if (typeof maybe.result === 'string' || typeof maybe.result === 'number') return String(maybe.result);
    return '';
  }
  return String(value);
}

function optionalText(row: unknown[], index: number | undefined, field: FieldKey): { value: string | null; problem?: string } {
  const raw = cellText(row, index).trim();
  if (BLANKISH.has(raw.toLowerCase())) return { value: null };

  const limit = MAX_LENGTHS[field];
  if (limit && raw.length > limit) {
    return { value: null, problem: `longer than ${limit} characters (${raw.length})` };
  }
  // Collapse the newlines and runs of spaces that come from pasting into a form.
  return { value: raw.replace(/\s+/g, ' ') };
}

/**
 * Pull a year of passing out of whatever was typed.
 *
 * "2011", "Batch of 2011", "2011 batch", "2008-2011" all mean 2011. For a range
 * the *last* year is taken, because the question asks when they passed out, and
 * people answer it with the span they attended.
 */
export function parseBatchYear(raw: string, now = new Date()): { year: number } | { reason: string } {
  const text = raw.trim();
  if (text === '') return { reason: 'empty' };

  // Any four-digit run, not just 19xx/20xx: someone who typed 1823 should be
  // told the year is out of range, which is actionable, rather than that no
  // year was found, which sounds like the parser is broken.
  const years = [...text.matchAll(/\b\d{4}\b/g)].map((match) => Number(match[0]));
  if (years.length === 0) {
    // Two-digit years are genuinely ambiguous: '11 could be 1911 or 2011.
    return { reason: `no four-digit year found in ${JSON.stringify(text.slice(0, 40))}` };
  }

  const year = Math.max(...years);
  const ceiling = now.getFullYear() + 6; // allows a current student's expected year
  if (year < 1900 || year > ceiling) {
    return { reason: `year ${year} is outside 1900–${ceiling}` };
  }
  return { year };
}

function parseTimestamp(raw: string): Date | null {
  if (raw.trim() === '') return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Validate one row. `rowNumber` is the sheet row the operator would click on. */
export function validateRow(row: unknown[], map: ColumnMap, rowNumber: number): { ok: true; row: ValidRow; warnings: RowProblem[] } | { ok: false; problems: RowProblem[] } {
  const problems: RowProblem[] = [];
  const warnings: RowProblem[] = [];
  const problem = (field: FieldKey | 'row', reason: string) => problems.push({ rowNumber, field, reason });
  const warn = (field: FieldKey | 'row', reason: string) => warnings.push({ rowNumber, field, reason });

  // --- required ---------------------------------------------------------------
  const nameCell = optionalText(row, map.fullName, 'fullName');
  if (nameCell.problem) problem('fullName', nameCell.problem);
  if (!nameCell.value) problem('fullName', 'missing');

  const batchRaw = cellText(row, map.batchYear);
  const batch = parseBatchYear(batchRaw);
  if ('reason' in batch) problem('batchYear', batch.reason);

  // --- optional plaintext -----------------------------------------------------
  const stream = optionalText(row, map.stream, 'stream');
  const currentOrg = optionalText(row, map.currentOrg, 'currentOrg');
  const designation = optionalText(row, map.designation, 'designation');
  const previousRole = optionalText(row, map.previousRole, 'previousRole');
  const otherInfo = optionalText(row, map.otherInfo, 'otherInfo');
  for (const [field, cell] of [
    ['stream', stream], ['currentOrg', currentOrg], ['designation', designation],
    ['previousRole', previousRole], ['otherInfo', otherInfo],
  ] as const) {
    if (cell.problem) problem(field, cell.problem);
  }

  // --- contact ----------------------------------------------------------------
  const phone = normalisePhone(cellText(row, map.contact));
  let contact: string | null = null;
  if (phone.ok) {
    contact = phone.value;
  } else {
    // A bad number does not cost them their directory entry; it costs them the
    // number. The report lists it so the Association can ask.
    warn('contact', `${phone.reason} — imported without a contact number`);
  }

  // --- the two email columns --------------------------------------------------
  const gmail = readEmail(row, map.gmail, 'gmail', warn);
  const formEmail = readEmail(row, map.formEmail, 'formEmail', warn);

  const loginEmail = gmail ?? formEmail;
  if (!loginEmail) {
    warn('row', 'no usable email in either column — this person cannot sign in until an admin grants access');
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    warnings,
    row: {
      rowNumber,
      fullName: nameCell.value!,
      batchYear: (batch as { year: number }).year,
      stream: stream.value,
      currentOrg: currentOrg.value,
      designation: designation.value,
      previousRole: previousRole.value,
      contact,
      gmail,
      formEmail,
      otherInfo: otherInfo.value,
      submittedAt: parseTimestamp(cellText(row, map.timestamp)),
      loginEmail,
    },
  };
}

function readEmail(
  row: unknown[],
  index: number | undefined,
  field: FieldKey,
  warn: (field: FieldKey, reason: string) => void,
): string | null {
  const raw = cellText(row, index).trim();
  if (raw === '' || BLANKISH.has(raw.toLowerCase())) return null;
  const result = normaliseEmail(raw);
  if (!result.ok) {
    warn(field, `${result.reason} — address ignored`);
    return null;
  }
  return result.value;
}

/**
 * Validate a whole sheet and flag duplicates.
 *
 * Duplicates are found on the *normalised* login address, which is the whole
 * point of normalisation: `priya.menon@gmail.com` and `priyamenon@gmail.com`
 * are one person filling the form twice, and without this they would become two
 * directory entries and a unique-constraint failure at push time.
 *
 * The later row wins — it is the more recent answer.
 */
export function validateSheet(rows: unknown[][], map: ColumnMap, firstRowNumber = 2): ValidationOutcome {
  const valid: ValidRow[] = [];
  const rejected: RowProblem[] = [];
  const warnings: RowProblem[] = [];

  rows.forEach((row, offset) => {
    const rowNumber = firstRowNumber + offset;
    if (row.every((cell) => cellText([cell], 0).trim() === '')) return; // blank row

    const outcome = validateRow(row, map, rowNumber);
    if (outcome.ok) {
      valid.push(outcome.row);
      warnings.push(...outcome.warnings);
    } else {
      rejected.push(...outcome.problems);
    }
  });

  const seen = new Map<string, ValidRow>();
  const deduped: ValidRow[] = [];
  for (const row of valid) {
    if (!row.loginEmail) {
      deduped.push(row);
      continue;
    }
    const previous = seen.get(row.loginEmail);
    if (previous) {
      warnings.push({
        rowNumber: row.rowNumber,
        field: 'row',
        reason: `duplicate of row ${previous.rowNumber} (same address once normalised) — row ${row.rowNumber} wins, being the later answer`,
      });
      deduped[deduped.indexOf(previous)] = row;
      seen.set(row.loginEmail, row);
    } else {
      seen.set(row.loginEmail, row);
      deduped.push(row);
    }
  }

  return { valid: deduped, rejected, warnings };
}
