/**
 * The run report.
 *
 * Counts and error reasons only. No name, no number, no address, no free text —
 * a report that quotes the data it was validating is a plaintext copy of the
 * spreadsheet sitting in a directory nobody remembers to clean out.
 *
 * Row numbers are included because they are what makes a report actionable:
 * "row 213: batchYear — no four-digit year found" sends the operator to a cell.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { RowProblem } from './validate.ts';
import type { Preview } from './preview.ts';

export interface RunReport {
  at: string;
  sheet: { name: string; headers: number; dataRows: number };
  mapping: Array<{ field: string; column: string | null; header: string | null }>;
  unusedHeaders: string[];
  counts: Preview['counts'] & {
    validRows: number;
    rejectedRows: number;
    warnings: number;
    newGrants: number;
    withoutLogin: number;
  };
  rejected: RowProblem[];
  warnings: RowProblem[];
  applied: boolean;
  result?: { inserted: number; updated: number; grantsAdded: number; grantsLeftAlone: number };
}

export function writeReport(report: RunReport, directory = 'tools/ingest/reports'): string {
  mkdirSync(directory, { recursive: true });
  const stamp = report.at.replace(/[:.]/g, '-');
  const path = join(directory, `ingest-${stamp}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  return path;
}

/**
 * Guard against a future edit that starts putting values into reasons. The
 * report is written to disk and kept, so this check is cheap insurance.
 */
export function assertReportIsClean(report: RunReport, secrets: string[]): void {
  const serialised = JSON.stringify(report);
  for (const secret of secrets) {
    if (secret && secret.length > 3 && serialised.includes(secret)) {
      throw new Error(
        'Refusing to write the report: it contains a value from the spreadsheet. Reports hold counts and reasons only.',
      );
    }
  }
}
