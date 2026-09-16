/**
 * Row validation: one spreadsheet row in, one clean record or a list of reasons out.
 *
 * COPIED from oxvercity/tools/ingest/validate.ts to make the admin app
 * self-contained for separate Hostinger hosting.
 * Import paths adjusted to point at the local core modules.
 */

import { normaliseEmail } from '../core/email.ts';
import { normalisePhone } from '../core/phone.ts';
import type { ColumnMap, FieldKey } from './columns.ts';

/** A row that is safe to encrypt and store. */
export interface ValidRow {
  rowNumber: number;
  /** Null when the row had no name. Migration 0014 allows the column to be null. */
  fullName: string | null;
  /** Null when no readable four-digit year was in the cell. */
  batchYear: number | null;
  stream: string | null;
  currentOrg: string | null;
  designation: string | null;
  previousRole: string | null;
  contact: string | null;
  gmail: string | null;
  formEmail: string | null;
  otherInfo: string | null;
  submittedAt: Date | null;
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
  warnings: RowProblem[];
}

/**
 * Ceilings, raised in step with migration 0014.
 *
 * These are not opinions about how long a job title ought to be. They exist so
 * a spreadsheet cannot push unbounded text into the database, and the old
 * numbers were set from a guess rather than from the sheet: a 240-character
 * designation is somebody with a long role at an organisation with a long name,
 * and under the previous 200 it lost their entire row.
 *
 * Must not exceed the CHECK constraints in 0014, or a row passes here and then
 * fails at the insert with a message naming a constraint the operator has never
 * heard of.
 */
const MAX_LENGTHS: Partial<Record<FieldKey, number>> = {
  fullName: 200,
  stream: 200,
  currentOrg: 500,
  designation: 500,
  previousRole: 1000,
  otherInfo: 4000,
};

const BLANKISH = new Set(['', '-', '--', 'na', 'n/a', 'n.a', 'n.a.', 'nil', 'none', 'null', 'nan']);

function cellText(row: unknown[], index: number | undefined): string {
  if (index === undefined) return '';
  const value = row[index];
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const maybe = value as { text?: unknown; result?: unknown; richText?: Array<{ text?: string }> };
    if (Array.isArray(maybe.richText)) return maybe.richText.map((part) => part.text ?? '').join('');
    if (typeof maybe.text === 'string') return maybe.text;
    if (typeof maybe.result === 'string' || typeof maybe.result === 'number') return String(maybe.result);
    return '';
  }
  return String(value);
}

/**
 * Read one optional cell.
 *
 * ## Over-length truncates; it does not reject
 *
 * This used to return a `problem`, which the caller turned into a rejection —
 * so one cell four characters past its ceiling discarded the whole person,
 * including the email address that would have let them sign in and correct it.
 * That is the wrong trade for a Form export filled in by five hundred people
 * over several years.
 *
 * Now the value is cut to the limit and the caller is handed a `warning`. The
 * operator sees exactly which rows were shortened and by how much in the import
 * preview, and can widen the sheet or edit the record afterwards. Data that
 * arrives slightly clipped beats data that never arrives.
 */
function optionalText(
  row: unknown[],
  index: number | undefined,
  field: FieldKey,
): { value: string | null; warning?: string } {
  const raw = cellText(row, index).trim();
  if (BLANKISH.has(raw.toLowerCase())) return { value: null };

  const collapsed = raw.replace(/\s+/g, ' ');
  const limit = MAX_LENGTHS[field];
  if (limit && collapsed.length > limit) {
    return {
      value: collapsed.slice(0, limit),
      warning: `${collapsed.length} characters — kept the first ${limit}, the rest was cut`,
    };
  }
  return { value: collapsed };
}

export function parseBatchYear(raw: string, now = new Date()): { year: number } | { reason: string } {
  const text = raw.trim();
  if (text === '') return { reason: 'empty' };

  const years = [...text.matchAll(/\b\d{4}\b/g)].map((match) => Number(match[0]));
  if (years.length === 0) {
    return { reason: `no four-digit year found in ${JSON.stringify(text.slice(0, 40))}` };
  }

  const year = Math.max(...years);
  const ceiling = now.getFullYear() + 6;
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

export function validateRow(row: unknown[], map: ColumnMap, rowNumber: number): { ok: true; row: ValidRow; warnings: RowProblem[] } | { ok: false; problems: RowProblem[] } {
  const problems: RowProblem[] = [];
  const warnings: RowProblem[] = [];
  const warn = (field: FieldKey | 'row', reason: string) => warnings.push({ rowNumber, field, reason });

  /*
   * Nothing below rejects a row any more.
   *
   * `fullName` and `batchYear` used to be required here, and between them they
   * were the only two rejections this function ever produced. A blank name cell
   * or a year written as "Batch of '04" threw away the entire person — name,
   * employer, phone number, and the email address that was the one thing worth
   * having, because it is what lets them sign in and fix the rest themselves.
   *
   * Migration 0014 made both columns nullable so the record can exist with a
   * gap in it. Everything that displays a record is responsible for rendering
   * that gap honestly; see `displayName` in oxvercity/src/lib/visibility.ts.
   *
   * `problems` is kept rather than deleted. It is the mechanism by which a row
   * can be refused, and a future rule that genuinely must refuse one — say, a
   * value that cannot be stored at all — should use it. Today nothing does.
   */
  const nameCell = optionalText(row, map.fullName, 'fullName');
  if (nameCell.warning) warn('fullName', nameCell.warning);
  if (!nameCell.value) warn('fullName', 'no name in this row — imported without one');

  const batchRaw = cellText(row, map.batchYear);
  const batch = parseBatchYear(batchRaw);
  const batchYear = 'year' in batch ? batch.year : null;
  if (batchYear === null) {
    // The reason still travels, because "empty" and "no four-digit year found
    // in 'Batch of 04'" send the operator to different fixes.
    warn('batchYear', `${(batch as { reason: string }).reason} — imported without a batch year`);
  }

  const stream = optionalText(row, map.stream, 'stream');
  const currentOrg = optionalText(row, map.currentOrg, 'currentOrg');
  const designation = optionalText(row, map.designation, 'designation');
  const previousRole = optionalText(row, map.previousRole, 'previousRole');
  const otherInfo = optionalText(row, map.otherInfo, 'otherInfo');
  for (const [field, cell] of [
    ['stream', stream], ['currentOrg', currentOrg], ['designation', designation],
    ['previousRole', previousRole], ['otherInfo', otherInfo],
  ] as const) {
    if (cell.warning) warn(field, cell.warning);
  }

  const phone = normalisePhone(cellText(row, map.contact));
  let contact: string | null = null;
  if (phone.ok) {
    contact = phone.value;
  } else {
    warn('contact', `${phone.reason} — imported without a contact number`);
  }

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
      fullName: nameCell.value,
      batchYear,
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

export function validateSheet(rows: unknown[][], map: ColumnMap, firstRowNumber = 2): ValidationOutcome {
  const valid: ValidRow[] = [];
  const rejected: RowProblem[] = [];
  const warnings: RowProblem[] = [];

  rows.forEach((row, offset) => {
    const rowNumber = firstRowNumber + offset;
    if (row.every((cell) => cellText([cell], 0).trim() === '')) return;

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
