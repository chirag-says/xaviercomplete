import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { columnLetter, detectColumns, normaliseHeader } from '../tools/ingest/columns.ts';

/**
 * Headers written the way Google Forms actually writes them — a question, not a
 * label. This is the shape the real sheet will have.
 */
const REAL_WORLD_HEADERS = [
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

describe('detectColumns', () => {
  it('maps every column of the real form', () => {
    const result = detectColumns(REAL_WORLD_HEADERS);
    assert.deepEqual(result.missingRequired, []);
    assert.deepEqual(result.map, {
      timestamp: 0,
      formEmail: 1,
      fullName: 2,
      batchYear: 3,
      stream: 4,
      currentOrg: 5,
      designation: 6,
      previousRole: 7,
      contact: 8,
      gmail: 9,
      otherInfo: 10,
    });
  });

  it('keeps the two email columns apart, which is the one that really matters', () => {
    // Get this wrong and the login allowlist is built from the wrong address.
    const result = detectColumns(REAL_WORLD_HEADERS);
    assert.equal(result.map.formEmail, 1);
    assert.equal(result.map.gmail, 9);
  });

  it('does not confuse previous role with current organisation', () => {
    const result = detectColumns([
      'Name', 'Batch', 'Previous organisation and role', 'Current organisation', 'Designation',
    ]);
    assert.equal(result.map.previousRole, 2);
    assert.equal(result.map.currentOrg, 3);
    assert.equal(result.map.designation, 4);
  });

  it('survives the columns being reordered', () => {
    const shuffled = [
      'Gmail ID (only for accessing the database)',
      'Full name',
      'Contact number',
      'Batch / Year of passing',
    ];
    const result = detectColumns(shuffled);
    assert.equal(result.map.gmail, 0);
    assert.equal(result.map.fullName, 1);
    assert.equal(result.map.contact, 2);
    assert.equal(result.map.batchYear, 3);
    assert.deepEqual(result.missingRequired, []);
  });

  it('is deterministic — the same sheet always yields the same mapping', () => {
    const a = detectColumns(REAL_WORLD_HEADERS);
    const b = detectColumns(REAL_WORLD_HEADERS);
    assert.deepEqual(a.map, b.map);
  });

  it('refuses rather than guesses when a required column is absent', () => {
    const result = detectColumns(['Timestamp', 'Email Address', 'Contact number']);
    assert.deepEqual(result.missingRequired.sort(), ['batchYear', 'fullName']);
  });

  it('never assigns one header to two fields', () => {
    const result = detectColumns(['Name', 'Year of passing', 'Organisation']);
    const used = Object.values(result.map);
    assert.equal(new Set(used).size, used.length);
  });

  it('reports headers it did not use, so a missed column is visible', () => {
    const result = detectColumns([...REAL_WORLD_HEADERS, 'Are you willing to mentor students?']);
    assert.deepEqual(result.unusedHeaders, ['Are you willing to mentor students?']);
  });

  it('lets column-map.json override the heuristic outright', () => {
    const headers = ['Timestamp', 'Full name', 'Batch', 'Scribble box'];
    const result = detectColumns(headers, { otherInfo: 'Scribble box' });
    assert.equal(result.map.otherInfo, 3);
  });

  it('explains its choices for the confirmation screen', () => {
    const result = detectColumns(REAL_WORLD_HEADERS);
    const contact = result.explain.find((entry) => entry.key === 'contact');
    assert.equal(contact?.column, 'I');
    assert.match(contact?.header ?? '', /^Contact number/);
  });
});

describe('helpers', () => {
  it('normalises headers the way a person would read them', () => {
    assert.equal(normaliseHeader('  Batch / Year of passing  '), 'batch year of passing');
    assert.equal(normaliseHeader('Designation & Role!'), 'designation role');
  });

  it('converts column indexes to spreadsheet letters', () => {
    assert.equal(columnLetter(0), 'A');
    assert.equal(columnLetter(10), 'K');
    assert.equal(columnLetter(25), 'Z');
    assert.equal(columnLetter(26), 'AA');
  });
});
