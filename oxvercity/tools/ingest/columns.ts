/**
 * Working out which spreadsheet column is which.
 *
 * Google Forms turns a question into a header, so the real sheet does not say
 * "Contact number" — it says something like "Your contact number (this will be
 * visible to other alumni)". Matching on exact strings would fail on the real
 * file and matching on position alone would silently mis-file a column if
 * anyone ever reordered the form.
 *
 * So: score every (field, header) pair on keywords, assign greedily by best
 * score, and then *show the operator the mapping it chose* before anything is
 * written. The confirmation step is what makes a fuzzy matcher safe.
 *
 * If the heuristic gets it wrong, `tools/ingest/column-map.json` overrides it
 * by header name, with no need to edit the sensitive spreadsheet.
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
  /** A missing required column stops the import; everything else is merely absent. */
  required: boolean;
  /** Higher weight = more distinctive. First match in the list wins for that spec. */
  patterns: Array<[RegExp, number]>;
  /** A header matching any of these cannot be this field, whatever else it scored. */
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
    // Column 10 also says "email"; "gmail" must never land here.
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
  /** What the operator is shown before confirming: field → the header it matched. */
  explain: Array<{ key: FieldKey; label: string; column: string | null; header: string | null }>;
  /** Required fields with nowhere to come from. Non-empty means refuse to import. */
  missingRequired: FieldKey[];
  /** Headers that matched nothing. Harmless, but worth showing in case one matters. */
  unusedHeaders: string[];
}

/** Lowercase, punctuation to spaces, runs collapsed — so "Batch/Year" and "batch - year" agree. */
export function normaliseHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Spreadsheet column letter for a zero-based index: 0 → A, 26 → AA. */
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

/**
 * @param headers  the sheet's header row, in order
 * @param overrides optional `{ contact: "Your mobile number" }` from column-map.json,
 *                  matched against the normalised header
 */
export function detectColumns(headers: string[], overrides: Partial<Record<FieldKey, string>> = {}): MappingResult {
  const normalised = headers.map(normaliseHeader);
  const map: ColumnMap = {};
  const claimedHeader = new Set<number>();

  // Explicit overrides win outright and are not scored.
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

  // Greedy by score. Ties break on column order, so the assignment is
  // deterministic and a re-run of the same sheet always produces the same map.
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
