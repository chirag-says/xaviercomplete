/**
 * Synthetic data only. Every name below is a placeholder, matching the rule the
 * project has followed from the start: the real spreadsheet is never seen here,
 * and the tool is proven against invented rows with the same eleven columns.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { ColumnMap } from '../tools/ingest/columns.ts';
import { parseBatchYear, validateRow, validateSheet } from '../tools/ingest/validate.ts';

const MAP: ColumnMap = {
  timestamp: 0, formEmail: 1, fullName: 2, batchYear: 3, stream: 4,
  currentOrg: 5, designation: 6, previousRole: 7, contact: 8, gmail: 9, otherInfo: 10,
};

/** A well-formed row; override any cell per test. */
function row(overrides: Partial<Record<number, unknown>> = {}): unknown[] {
  const base: unknown[] = [
    '2026-02-14T09:31:00.000Z',
    'respondent.one@gmail.com',
    'Placeholder One',
    '2011',
    'B.Sc. Physics',
    'Placeholder Industries',
    'Senior Analyst',
    'Placeholder Refineries, Analyst',
    '9876543210',
    'placeholder.one@gmail.com',
    'Happy to mentor students.',
  ];
  for (const [index, value] of Object.entries(overrides)) base[Number(index)] = value;
  return base;
}

function valid(overrides: Partial<Record<number, unknown>> = {}) {
  const result = validateRow(row(overrides), MAP, 7);
  assert.ok(result.ok, `expected the row to validate: ${JSON.stringify('problems' in result ? result.problems : '')}`);
  return result;
}

/**
 * The row still validates; this returns the warning raised against `field`.
 *
 * There is deliberately no `rejectedFor` helper any more. `validateRow` no
 * longer refuses a row for a missing name, an unreadable year or an over-length
 * cell — migration 0014 made the first two nullable and the third truncates —
 * so a helper that asserted `!result.ok` would have nothing left to assert.
 */
function warningFor(overrides: Partial<Record<number, unknown>>, field: string) {
  const result = validateRow(row(overrides), MAP, 7);
  assert.ok(result.ok, 'expected the row to be imported, not rejected');
  const hit = result.warnings.find((warning) => warning.field === field);
  assert.ok(hit, `expected a warning on ${field}, got ${JSON.stringify(result.warnings)}`);
  return hit.reason;
}

describe('validateRow — a clean row', () => {
  it('normalises every field on the way through', () => {
    const { row: record } = valid();
    assert.equal(record.fullName, 'Placeholder One');
    assert.equal(record.batchYear, 2011);
    assert.equal(record.contact, '+919876543210', 'phone must be E.164');
    assert.equal(record.gmail, 'placeholderone@gmail.com', 'gmail must be canonicalised');
    assert.equal(record.formEmail, 'respondentone@gmail.com');
    assert.equal(record.loginEmail, 'placeholderone@gmail.com', 'column 10 is the login identity');
    assert.equal(record.submittedAt?.getUTCFullYear(), 2026);
  });

  it('falls back to the form address when there is no Gmail column value', () => {
    const { row: record } = valid({ 9: '' });
    assert.equal(record.gmail, null);
    assert.equal(record.loginEmail, 'respondentone@gmail.com');
  });

  it('collapses the whitespace people paste in', () => {
    const { row: record } = valid({ 5: '  Placeholder\n  Industries  ' });
    assert.equal(record.currentOrg, 'Placeholder Industries');
  });

  it('treats the many spellings of "nothing here" as absent', () => {
    for (const blank of ['', '-', 'NA', 'n/a', 'Nil', 'none', '  ']) {
      const { row: record } = valid({ 4: blank, 7: blank, 10: blank });
      assert.equal(record.stream, null, blank);
      assert.equal(record.previousRole, null, blank);
      assert.equal(record.otherInfo, null, blank);
    }
  });

  it('reads a rich-text cell rather than stringifying the object', () => {
    const { row: record } = valid({ 2: { richText: [{ text: 'Placeholder ' }, { text: 'Two' }] } });
    assert.equal(record.fullName, 'Placeholder Two');
  });
});

describe('validateRow — an incomplete row is imported, not discarded', () => {
  /*
   * These four assertions are the whole point of migration 0014, and they are
   * the inverse of what this file used to say.
   *
   * Each of these rows was previously thrown away in full — taking with it the
   * email address that is the one thing worth having, because it is what lets
   * the person sign in and fix everything else themselves. A directory entry
   * with a gap beats no directory entry.
   */
  it('keeps a row with no name, and says so', () => {
    const { row: record } = valid({ 2: '   ' });
    assert.equal(record.fullName, null, 'stored as null, never as a placeholder string');
    assert.match(warningFor({ 2: '   ' }, 'fullName'), /no name in this row/);
  });

  it('keeps a row whose year cannot be read, and says why', () => {
    assert.equal(valid({ 3: 'second batch' }).row.batchYear, null);
    assert.match(warningFor({ 3: 'second batch' }, 'batchYear'), /no four-digit year/);
    assert.match(warningFor({ 3: '' }, 'batchYear'), /empty/);
  });

  it('refuses an impossible year rather than storing it', () => {
    // Missing and wrong are different. A year outside the range is a wrong
    // value, and storing it would put a false claim on a public page — so it
    // becomes a gap, not a guess.
    assert.equal(valid({ 3: '1823' }).row.batchYear, null);
    assert.match(warningFor({ 3: '1823' }, 'batchYear'), /outside 1900/);
  });

  it('truncates an over-length field instead of dropping the person', () => {
    const { row: record } = valid({ 2: 'x'.repeat(250) });
    assert.equal(record.fullName?.length, 200, 'cut to the column ceiling');
    assert.match(warningFor({ 2: 'x'.repeat(250) }, 'fullName'), /250 characters — kept the first 200/);
  });

  it('accepts the longer designation and organisation the sheet actually contains', () => {
    // The 200-character ceiling was the single largest source of lost rows:
    // a long job title at an organisation with a long name exceeded it, and the
    // whole person went with it.
    const { row: record } = valid({ 5: 'y'.repeat(480), 6: 'z'.repeat(480) });
    assert.equal(record.currentOrg?.length, 480, 'well within the new 500');
    assert.equal(record.designation?.length, 480);
  });
});

describe('validateRow — warnings import the row anyway', () => {
  it('keeps the person but drops an unusable number', () => {
    const result = valid({ 8: '12345' });
    assert.equal(result.row.contact, null);
    assert.match(result.warnings.find((w) => w.field === 'contact')?.reason ?? '', /too_short/);
  });

  it('stores nothing for a number the alumnus declined to give', () => {
    const result = valid({ 8: 'NA' });
    assert.equal(result.row.contact, null);
    assert.equal(result.warnings.length, 0, '"NA" is an answer, not a problem');
  });

  it('drops an unusable address and says so', () => {
    const result = valid({ 9: 'not an address' });
    assert.equal(result.row.gmail, null);
    assert.match(result.warnings.find((w) => w.field === 'gmail')?.reason ?? '', /whitespace/);
  });

  it('flags a person who will have no way to sign in', () => {
    const result = valid({ 1: '', 9: '' });
    assert.equal(result.row.loginEmail, null);
    assert.match(result.warnings.find((w) => w.field === 'row')?.reason ?? '', /cannot sign in/);
  });
});

describe('parseBatchYear', () => {
  const now = new Date('2026-09-11T00:00:00Z');

  it('reads a year however it was written', () => {
    for (const [written, expected] of [
      ['2011', 2011], ['Batch of 2011', 2011], ['2011 batch', 2011], [' 2011 ', 2011],
      ['2008-2011', 2011], ['2008 to 2011', 2011],
    ] as const) {
      const result = parseBatchYear(written, now);
      assert.deepEqual(result, { year: expected }, written);
    }
  });

  it('allows a current student a few years ahead but not a fantasy', () => {
    assert.deepEqual(parseBatchYear('2030', now), { year: 2030 });
    assert.ok('reason' in parseBatchYear('2099', now));
  });

  it('refuses a two-digit year instead of guessing the century', () => {
    assert.ok('reason' in parseBatchYear("'11", now));
  });
});

describe('validateSheet', () => {
  it('imports every row it is given and reports the gaps as warnings', () => {
    const outcome = validateSheet(
      [
        row(),
        // Its own address on purpose: sharing the default one would make these
        // two the same person and the dedupe below would collapse them, which
        // is a different behaviour from the one under test here.
        row({ 2: '', 9: 'placeholder.two@gmail.com' }),
        row({ 9: 'placeholder.three@gmail.com', 8: 'nonsense' }),
      ],
      MAP,
    );
    // Three rows in, three rows out. The middle one has no name; it used to be
    // the rejection this test was named after.
    assert.equal(outcome.valid.length, 3);
    assert.equal(outcome.rejected.length, 0, 'nothing rejects a row any more');
    assert.ok(outcome.warnings.some((w) => w.field === 'fullName'));
    assert.ok(outcome.warnings.some((w) => w.field === 'contact'));
  });

  it('skips blank rows without reporting them', () => {
    const outcome = validateSheet([row(), new Array(11).fill(''), [null, null]], MAP);
    assert.equal(outcome.valid.length, 1);
    assert.equal(outcome.rejected.length, 0);
  });

  it('collapses one person who filled the form twice with the address spelt differently', () => {
    // This is the case that normalisation exists for. Without it these become
    // two directory entries and a unique-constraint failure at push time.
    const outcome = validateSheet(
      [
        row({ 9: 'placeholder.one@gmail.com', 5: 'Old Employer' }),
        row({ 9: 'placeholderone+alumni@googlemail.com', 5: 'New Employer' }),
      ],
      MAP,
    );
    assert.equal(outcome.valid.length, 1, 'one person, one row');
    assert.equal(outcome.valid[0]!.currentOrg, 'New Employer', 'the later answer wins');
    assert.match(outcome.warnings.find((w) => /duplicate/.test(w.reason))?.reason ?? '', /duplicate of row 2/);
  });

  it('keeps two people with no address apart rather than merging them', () => {
    const outcome = validateSheet(
      [row({ 1: '', 9: '', 2: 'Placeholder A' }), row({ 1: '', 9: '', 2: 'Placeholder B' })],
      MAP,
    );
    assert.equal(outcome.valid.length, 2);
  });

  it('numbers rows the way Excel does, so the operator can find them', () => {
    // Asserted on a warning rather than a rejection now, but the property under
    // test is the same and still matters: a report that says "row 2" has to
    // mean the second line of the operator's spreadsheet, header included.
    const outcome = validateSheet([row({ 2: '' })], MAP);
    assert.equal(outcome.warnings[0]!.rowNumber, 2, 'row 1 is the header');
    assert.equal(outcome.valid[0]!.rowNumber, 2);
  });
});
