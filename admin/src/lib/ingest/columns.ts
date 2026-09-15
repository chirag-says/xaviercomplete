/**
 * Working out which spreadsheet column is which.
 *
 * COPIED from oxvercity/tools/ingest/columns.ts to make the admin app
 * self-contained for separate Hostinger hosting.
 */

export type FieldKey =
  | 'timestamp'
  | 'formEmail'
  | 'fullName'
  | 'batchYear'
  | 'stream'
  | 'currentOrg'
  | 'designation'
  | 'previousRole'
  | 'contact'
  | 'gmail'
  | 'otherInfo';

interface ColumnSpec {
  key: FieldKey;
  label: string;
  required: boolean;
  patterns: Array<[RegExp, number]>;
  disqualifiers?: RegExp[];
}

const SPECS: ColumnSpec[] = [
  {
    key: 'timestamp',
    label: 'Timestamp',
    required: false,
    patterns: [[/\btimestamp\b/, 5], [/\bsubmitted\b/, 3], [/\bdate\b/, 2]],
  },
  {
    key: 'formEmail',
    label: 'Email Address (form respondent)',
    required: false,
    patterns: [[/\bemail address\b/, 5], [/^email$/, 5], [/\be[- ]?mail\b/, 3]],
    disqualifiers: [/\bgmail\b/],
  },
  {
    key: 'fullName',
    label: 'Full name',
    required: true,
    patterns: [[/\bfull name\b/, 6], [/^name$/, 5], [/\byour name\b/, 5], [/\bname\b/, 2]],
    disqualifiers: [/\borgani[sz]ation\b/, /\bcompany\b/, /\bcollege\b/],
  },
  {
    key: 'batchYear',
    label: 'Batch / Year of passing',
    required: true,
    patterns: [
      [/\byear of passing\b/, 6],
      [/\bbatch\b/, 5],
      [/\bpassing\b/, 4],
      [/\bgraduat\w*\b/, 3],
      [/\byear\b/, 2],
    ],
  },
  {
    key: 'stream',
    label: 'Stream of study',
    required: false,
    patterns: [
      [/\bstream\b/, 5],
      [/\bcourse\b/, 4],
      [/\bdiscipline\b/, 4],
      [/\bdepartment\b/, 3],
      [/\bprogramme?\b/, 3],
      [/\bspecriali[sz]ation\b/, 3],
    ],
  },
  {
    key: 'currentOrg',
    label: 'Current organisation',
    required: false,
    patterns: [
      [/\bcurrent organi[sz]ation\b/, 6],
      [/\bcurrent (company|employer|workplace)\b/, 6],
      [/\borgani[sz]ation\b/, 3],
      [/\b(company|employer)\b/, 3],
    ],
    disqualifiers: [/\bprevious\b/, /\bformer\b/, /\bpast\b/],
  },
  {
    key: 'designation',
    label: 'Designation and Role',
    required: false,
    patterns: [[/\bdesignation\b/, 6], [/\bjob title\b/, 5], [/\bposition\b/, 4], [/\brole\b/, 3]],
    disqualifiers: [/\bprevious\b/, /\bformer\b/, /\bpast\b/],
  },
  {
    key: 'previousRole',
    label: 'Previous organisation / role',
    required: false,
    patterns: [[/\bprevious\b/, 6], [/\bformer\b/, 5], [/\bpast\b/, 4], [/\bearlier\b/, 3]],
  },
  {
    key: 'contact',
    label: 'Contact number',
    required: false,
    patterns: [
      [/\bcontact (number|no)\b/, 6],
      [/\bmobile\b/, 5],
      [/\bphone\b/, 5],
      [/\bwhatsapp\b/, 4],
      [/\bcontact\b/, 2],
    ],
    disqualifiers: [/\bemail\b/, /\bgmail\b/],
  },
  {
    key: 'gmail',
    label: 'Gmail ID (database access)',
    required: false,
    patterns: [[/\bgmail\b/, 6], [/\bdatabase access\b/, 5], [/\bg[- ]?mail\b/, 5]],
  },
  {
    key: 'otherInfo',
    label: 'Any other info',
    required: false,
    patterns: [
      [/\bany other\b/, 6],
      [/\bother info\w*\b/, 6],
      [/\badditional\b/, 4],
      [/\bremarks?\b/, 4],
      [/\bcomments?\b/, 3],
      [/\banything else\b/, 5],
    ],
  },
];

export type ColumnMap = Partial<Record<FieldKey, number>>;

export interface MappingResult {
  map: ColumnMap;
  explain: Array<{ key: FieldKey; label: string; column: string | null; header: string | null }>;
  missingRequired: FieldKey[];
  unusedHeaders: string[];
}

export function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function scoreHeader(spec: ColumnSpec, normalised: string): number {
  if (spec.disqualifiers?.some((pattern) => pattern.test(normalised))) return 0;
  for (const [pattern, weight] of spec.patterns) {
    if (pattern.test(normalised)) return weight;
  }
  return 0;
}

export function detectColumns(headers: string[], overrides: Partial<Record<FieldKey, string>> = {}): MappingResult {
  const normalised = headers.map(normaliseHeader);
  const map: ColumnMap = {};
  const claimedHeader = new Set<number>();

  for (const [key, headerText] of Object.entries(overrides) as Array<[FieldKey, string]>) {
    const wanted = normaliseHeader(headerText);
    const index = normalised.indexOf(wanted);
    if (index !== -1) {
      map[key] = index;
      claimedHeader.add(index);
    }
  }

  const candidates: Array<{ key: FieldKey; index: number; score: number }> = [];
  for (const spec of SPECS) {
    if (map[spec.key] !== undefined) continue;
    normalised.forEach((headerText, index) => {
      const score = scoreHeader(spec, headerText);
      if (score > 0) candidates.push({ key: spec.key, index, score });
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  for (const candidate of candidates) {
    if (map[candidate.key] !== undefined || claimedHeader.has(candidate.index)) continue;
    map[candidate.key] = candidate.index;
    claimedHeader.add(candidate.index);
  }

  return {
    map,
    explain: SPECS.map((spec) => {
      const index = map[spec.key];
      return {
        key: spec.key,
        label: spec.label,
        column: index === undefined ? null : columnLetter(index),
        header: index === undefined ? null : (headers[index] ?? null),
      };
    }),
    missingRequired: SPECS.filter((spec) => spec.required && map[spec.key] === undefined).map((s) => s.key),
    unusedHeaders: headers.filter((_, index) => !claimedHeader.has(index) && headers[index]!.trim() !== ''),
  };
}

export const FIELD_LABELS: Record<FieldKey, string> = Object.fromEntries(
  SPECS.map((spec) => [spec.key, spec.label]),
) as Record<FieldKey, string>;
