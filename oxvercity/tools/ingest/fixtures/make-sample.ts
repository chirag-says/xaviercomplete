/**
 * Build a synthetic spreadsheet with the same eleven columns as the real one.
 *
 *   npm run ingest:sample
 *
 * This exists so the ingest tool can be proven end to end without anyone ever
 * seeing a real record — the boundary this project has held from the start.
 *
 * The rows are deliberately messy in the ways a Google Form actually is:
 * numbers written five different ways, "NA", one person who filled the form
 * twice with their address spelt differently, a year nobody can parse, a header
 * phrased as a question. If the tool handles this file, it will handle the real
 * one; if it chokes, better here.
 *
 * Every name is a placeholder. Nothing below describes a real Xaverian.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import ExcelJS from 'exceljs';

const HEADERS = [
  'Timestamp',
  'Email Address',
  'Full name (as you would like it to appear)',
  'Batch / Year of passing',
  'Stream of study',
  'Current organisation',
  'Designation and Role',
  'Previous organisation / role (if any)',
  'Contact number (will be shared only with other alumni)',
  'Gmail ID (only for accessing the database)',
  'Any other info you would like to share',
];

const STREAMS = ['B.Sc. Physics', 'B.Com.', 'B.A. English', 'B.Sc. Chemistry', 'B.B.A.', 'B.C.A.'];
const ROLES = ['Senior Analyst', 'Product Manager', 'Lecturer', 'Consultant', 'Founder', 'Registrar'];

/** Deterministic, so two runs produce the same file and diffs are meaningful. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function buildRows(count: number): unknown[][] {
  const random = seeded(20260911);
  const rows: unknown[][] = [];

  for (let i = 1; i <= count; i++) {
    const name = `Placeholder ${String(i).padStart(3, '0')}`;
    const handle = `placeholder.${String(i).padStart(3, '0')}`;
    const year = 1998 + Math.floor(random() * 26);
    const mobile = `9${String(Math.floor(random() * 900000000) + 100000000)}`;

    // The many ways people write a phone number into a text field.
    const phoneStyles = [
      mobile,
      `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}`,
      `0${mobile}`,
      `+91-${mobile}`,
      `91 ${mobile}`,
      'NA',
      '',
    ];

    rows.push([
      new Date(Date.UTC(2026, 1, 1 + (i % 28), 9, i % 60)).toISOString(),
      `${handle}@gmail.com`,
      name,
      String(year),
      STREAMS[i % STREAMS.length],
      `Placeholder ${['Industries', 'Systems', 'Foundation', 'Labs'][i % 4]}`,
      ROLES[i % ROLES.length],
      i % 3 === 0 ? `Placeholder Refineries, ${ROLES[(i + 2) % ROLES.length]}` : '',
      phoneStyles[i % phoneStyles.length],
      `${handle}@gmail.com`,
      i % 7 === 0 ? 'Happy to mentor students and take guest lectures.' : '',
    ]);
  }

  // --- the awkward cases, on purpose -------------------------------------------

  // Same person as row 2, address spelt differently and a newer employer.
  // Must collapse to one record, with this row winning.
  rows.push([
    '2026-03-02T11:15:00.000Z',
    'placeholder001@gmail.com',
    'Placeholder 001',
    '2001',
    STREAMS[1],
    'A Newer Employer',
    'Director',
    '',
    '+91 98765 43210',
    'placeholder001+alumni@googlemail.com',
    '',
  ]);

  // No year anyone can read: must be rejected with a reason, not guessed.
  rows.push([
    '2026-03-03T08:00:00.000Z', 'placeholder.900@gmail.com', 'Placeholder 900',
    'second batch', STREAMS[0], 'Placeholder Systems', 'Analyst', '', '9876500001',
    'placeholder.900@gmail.com', '',
  ]);

  // No name: rejected.
  rows.push([
    '2026-03-04T08:00:00.000Z', 'placeholder.901@gmail.com', '   ',
    '2014', STREAMS[2], '', '', '', '9876500002', 'placeholder.901@gmail.com', '',
  ]);

  // No usable address in either column: imports, but cannot sign in.
  rows.push([
    '2026-03-05T08:00:00.000Z', '', 'Placeholder 902',
    '2009', STREAMS[3], 'Placeholder Labs', 'Consultant', '', '9876500003', '', '',
  ]);

  // A number that cannot be dialled: the person imports, the number does not.
  rows.push([
    '2026-03-06T08:00:00.000Z', 'placeholder.903@gmail.com', 'Placeholder 903',
    '2016', STREAMS[4], 'Placeholder Industries', 'Lecturer', '', '12345',
    'placeholder.903@gmail.com', '',
  ]);

  // An international number, and free text that must never be displayed.
  rows.push([
    '2026-03-07T08:00:00.000Z', 'placeholder.904@gmail.com', 'Placeholder 904',
    '2003', STREAMS[5], 'Placeholder Overseas', 'Founder', 'Placeholder Labs, Engineer',
    '+44 7700 900123', 'placeholder.904@gmail.com',
    'Contactable on weekends only. Prefer email. Recovering from surgery until March.',
  ]);

  // A blank row in the middle, as spreadsheets always have.
  rows.push(new Array(11).fill(''));

  return rows;
}

async function main(): Promise<void> {
  const count = Number(process.argv[2] ?? 60);
  const outputPath = process.argv[3] ?? 'private-data/sample-alumni.xlsx';

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Form Responses 1');
  sheet.addRow(HEADERS);
  for (const row of buildRows(count)) sheet.addRow(row);

  mkdirSync(dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);

  process.stdout.write(
    `\n  Wrote ${outputPath} — ${count} generated rows plus 7 deliberately awkward ones.\n` +
      `  Entirely synthetic. No real alumnus appears in it.\n\n` +
      `  Try:  npm run ingest -- ${outputPath} --dry-run\n\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`\n  ${(error as Error).message}\n\n`);
  process.exit(1);
});
