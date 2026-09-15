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

const MAX_LENGTHS: Partial<Record<FieldKey, number>> = {
  fullName: 120,
  stream: 120,
  currentOrg: 200,
  designation: 200,
  previousRole: 400,
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

function optionalText(row: unknown[], index: number | undefined, field: FieldKey): { value: string | null; problem?: string } {
  const raw = cellText(row, index).trim();
  if (BLANKISH.has(raw.toLowerCase())) return { value: null };

  const limit = MAX_LENGTHS[field];
  if (limit && raw.length > limit) {
    return { value: null, problem: `longer than ${limit} characters (${raw.length})` };
  }
  return { value: raw.replace(/\s+/g, ' ') };
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
  const problem = (field: FieldKey | 'row', reason: string) => problems.push({ rowNumber, field, reason });
  const warn = (field: FieldKey | 'row', reason: string) => warnings.push({ rowNumber, field, reason });

  const nameCell = optionalText(row, map.fullName, 'fullName');
  if (nameCell.problem) problem('fullName', nameCell.problem);
  if (!nameCell.value) problem('fullName', 'missing');

  const batchRaw = cellText(row, map.batchYear);
  const batch = parseBatchYear(batchRaw);
  if ('reason' in batch) problem('batchYear', batch.reason);

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
