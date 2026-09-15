/**
 * The masked dry-run.
 *
 * The rule, which is simple enough to hold in your head while reviewing a diff:
 *
 *   **The preview shows exactly what the public site would show, and masks
 *   everything else.**
 *
 * Name, batch, stream, organisation and designation are Tier 0 — already
 * visible to anyone on the internet, so showing them here reveals nothing new
 * and lets the operator recognise a row. Contact numbers, both email columns
 * and the free-text field are masked, on your own screen, in your own terminal.
 * Shoulder-surfing is real, screenshots get pasted into chats, and a terminal
 * scrollback outlives the session.
 *
 * Free text is never shown even partially: it is where people write health
 * details and family information, and no prefix of it is safe to display.
 */

import { maskEmail } from '../../src/lib/core/email.ts';
import { maskPhone } from '../../src/lib/core/phone.ts';
import { FIELD_LABELS, type FieldKey } from './columns.ts';
import type { Action, ImportPlan } from './plan.ts';

/** Fields whose values must never be rendered in full. */
const MASKED: ReadonlySet<string> = new Set(['contact', 'gmail', 'formEmail', 'otherInfo']);

export function maskValue(field: string, value: string | number | null): string {
  if (value === null || value === '') return '—';
  const text = String(value);

  if (!MASKED.has(field)) return text;
  if (field === 'contact') return maskPhone(text);
  if (field === 'gmail' || field === 'formEmail') return maskEmail(text);
  // otherInfo: length only. Never a prefix.
  return `«free text, ${text.length} character${text.length === 1 ? '' : 's'}»`;
}

export interface PreviewEntry {
  rowNumber: number;
  kind: Action['kind'];
  id: string;
  /** Public-tier, shown as-is. */
  name: string;
  batchYear: number;
  changes: Array<{ label: string; from: string; to: string }>;
  skipped: Array<{ label: string; from: string; to: string }>;
}

export interface Preview {
  entries: PreviewEntry[];
  counts: ImportPlan['counts'];
  newGrants: number;
  withoutLogin: number;
}

export function buildPreview(plan: ImportPlan): Preview {
  const label = (field: string) => FIELD_LABELS[field as FieldKey] ?? field;

  return {
    entries: plan.actions.map((action) => ({
      rowNumber: action.row.rowNumber,
      kind: action.kind,
      id: action.id,
      name: action.row.fullName,
      batchYear: action.row.batchYear,
      changes:
        action.kind === 'update'
          ? action.changes.map((c) => ({
              label: label(c.field),
              from: maskValue(c.field, c.from),
              to: maskValue(c.field, c.to),
            }))
          : [],
      skipped:
        action.kind === 'update'
          ? action.skipped.map((c) => ({
              label: label(c.field),
              from: maskValue(c.field, c.from),
              to: maskValue(c.field, c.to),
            }))
          : [],
    })),
    counts: plan.counts,
    newGrants: plan.newGrants.length,
    withoutLogin: plan.withoutLogin,
  };
}

/**
 * Assert that a rendered preview carries no plaintext secret. Called before
 * anything is printed or served — a masking bug should stop the tool, not
 * quietly publish the sheet to a terminal.
 */
export function assertNothingLeaked(rendered: string, plan: ImportPlan): void {
  for (const action of plan.actions) {
    const { contact, gmail, formEmail, otherInfo } = action.row;
    for (const [field, secret] of [
      ['contact', contact], ['gmail', gmail], ['formEmail', formEmail], ['otherInfo', otherInfo],
    ] as const) {
      if (secret && rendered.includes(secret)) {
        throw new Error(
          `Refusing to display the preview: row ${action.row.rowNumber} would show its ${field} in the clear. This is a masking bug — fix it before importing.`,
        );
      }
    }
  }
}
