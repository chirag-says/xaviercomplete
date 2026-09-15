import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildPlan, toggleDefaults, type ExistingRecord } from '../tools/ingest/plan.ts';
import type { ValidRow } from '../tools/ingest/validate.ts';

function sheetRow(overrides: Partial<ValidRow> = {}): ValidRow {
  return {
    rowNumber: 2,
    fullName: 'Placeholder One',
    batchYear: 2011,
    stream: 'B.Sc. Physics',
    currentOrg: 'Placeholder Industries',
    designation: 'Senior Analyst',
    previousRole: 'Placeholder Refineries, Analyst',
    contact: '+919876543210',
    gmail: 'placeholderone@gmail.com',
    formEmail: 'respondentone@gmail.com',
    otherInfo: null,
    submittedAt: new Date('2026-02-14T09:31:00Z'),
    loginEmail: 'placeholderone@gmail.com',
    ...overrides,
  };
}

function dbRow(overrides: Partial<ExistingRecord> = {}): ExistingRecord {
  return {
    id: 'k3f9x2m7qp4w',
    loginHmacHex: 'hmac:placeholderone@gmail.com',
    fullName: 'Placeholder One',
    batchYear: 2011,
    stream: 'B.Sc. Physics',
    currentOrg: 'Placeholder Industries',
    designation: 'Senior Analyst',
    previousRole: 'Placeholder Refineries, Analyst',
    contact: '+919876543210',
    gmail: 'placeholderone@gmail.com',
    formEmail: 'respondentone@gmail.com',
    otherInfo: null,
    ownerUpdatedAt: null,
    ...overrides,
  };
}

const hmacHexOf = (email: string) => `hmac:${email}`;
let counter = 0;
const mintId = () => `generated${String(counter++).padStart(4, '0')}`;

function planFor(rows: ValidRow[], existing: ExistingRecord[]) {
  counter = 0;
  return buildPlan(rows, new Map(existing.map((r) => [r.loginHmacHex, r])), hmacHexOf, mintId);
}

describe('buildPlan — first import', () => {
  it('inserts everyone and queues every login for the allowlist', () => {
    const plan = planFor([sheetRow(), sheetRow({ loginEmail: 'placeholdertwo@gmail.com' })], []);
    assert.equal(plan.counts.insert, 2);
    assert.equal(plan.counts.update, 0);
    assert.equal(plan.newGrants.length, 2);
  });

  it('still imports someone with no address, but does not grant them access', () => {
    const plan = planFor([sheetRow({ loginEmail: null, gmail: null, formEmail: null })], []);
    assert.equal(plan.counts.insert, 1);
    assert.equal(plan.newGrants.length, 0);
    assert.equal(plan.withoutLogin, 1);
  });
});

describe('buildPlan — re-import', () => {
  it('leaves an identical row alone', () => {
    const plan = planFor([sheetRow()], [dbRow()]);
    assert.equal(plan.counts.unchanged, 1);
    assert.equal(plan.counts.update, 0);
  });

  it('updates the fields that actually changed and no others', () => {
    const plan = planFor([sheetRow({ currentOrg: 'New Employer' })], [dbRow()]);
    const action = plan.actions[0]!;
    assert.ok(action.kind === 'update');
    assert.deepEqual(action.changes.map((c) => c.field), ['currentOrg']);
  });

  it('matches on the hashed login address, not the name', () => {
    // Two people can share a name; a changed name must not create a second row.
    const plan = planFor([sheetRow({ fullName: 'Placeholder One-Two' })], [dbRow()]);
    assert.equal(plan.counts.update, 1);
    assert.equal(plan.counts.insert, 0);
  });

  it('does not erase a held value because the new sheet left the cell blank', () => {
    // A blank cell is an absence of information, not an instruction to delete.
    const plan = planFor([sheetRow({ contact: null, designation: null })], [dbRow()]);
    assert.equal(plan.counts.unchanged, 1);
  });

  it('reuses the existing id rather than minting a new one', () => {
    const plan = planFor([sheetRow({ currentOrg: 'New Employer' })], [dbRow()]);
    assert.equal(plan.actions[0]!.id, 'k3f9x2m7qp4w');
  });
});

describe('buildPlan — a profile the alumnus has edited', () => {
  const edited = { ownerUpdatedAt: new Date('2026-06-01T00:00:00Z') };

  it('refuses to overwrite a field its owner has taken charge of', () => {
    const plan = planFor(
      [sheetRow({ currentOrg: 'Stale Spreadsheet Employer', contact: '+919999999999' })],
      [dbRow({ ...edited, currentOrg: 'What They Corrected It To' })],
    );
    const action = plan.actions[0]!;
    assert.ok(action.kind === 'update');
    assert.deepEqual(action.changes, [], 'nothing owner-owned may be written');
    assert.deepEqual(action.skipped.map((c) => c.field).sort(), ['contact', 'currentOrg']);
    assert.equal(plan.counts.skippedFields, 2);
  });

  it('still updates the identity fields the spreadsheet owns', () => {
    const plan = planFor(
      [sheetRow({ fullName: 'Placeholder One (married name)', currentOrg: 'Stale' })],
      [dbRow({ ...edited, currentOrg: 'Theirs' })],
    );
    const action = plan.actions[0]!;
    assert.ok(action.kind === 'update');
    assert.deepEqual(action.changes.map((c) => c.field), ['fullName']);
    assert.deepEqual(action.skipped.map((c) => c.field), ['currentOrg']);
  });

  it('reports the divergence rather than hiding it', () => {
    const plan = planFor(
      [sheetRow({ designation: 'From The Sheet' })],
      [dbRow({ ...edited, designation: 'From The Alumnus' })],
    );
    const action = plan.actions[0]!;
    assert.ok(action.kind === 'update');
    assert.deepEqual(action.skipped[0], {
      field: 'designation',
      from: 'From The Alumnus',
      to: 'From The Sheet',
    });
  });
});

describe('toggleDefaults', () => {
  it('turns the contact toggle on only when a number was supplied', () => {
    assert.equal(toggleDefaults(sheetRow()).showContact, true);
    assert.equal(toggleDefaults(sheetRow({ contact: null })).showContact, false);
  });

  it('defaults the Gmail toggle on, and off when there is no Gmail to show', () => {
    assert.equal(toggleDefaults(sheetRow()).showGmail, true);
    // The database constraint show_gmail_needs_a_gmail would reject the alternative.
    assert.equal(toggleDefaults(sheetRow({ gmail: null })).showGmail, false);
  });
});
