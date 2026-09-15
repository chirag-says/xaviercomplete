/**
 * Masking tests.
 *
 * The dry-run is displayed on a screen and written to a terminal scrollback
 * that outlives the session. If masking breaks, the tool prints five hundred
 * phone numbers and nobody notices until the screenshot is already in a group
 * chat. `assertNothingLeaked` is the backstop, so it is tested for both the
 * case where it should pass and the case where it must fire.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { assertNothingLeaked, buildPreview, maskValue } from '../tools/ingest/preview.ts';
import { buildPlan } from '../tools/ingest/plan.ts';
import type { ValidRow } from '../tools/ingest/validate.ts';

const SECRET_PHONE = '+919876543210';
const SECRET_EMAIL = 'placeholderone@gmail.com';
const SECRET_TEXT = 'Recovering from surgery until March.';

function sheetRow(overrides: Partial<ValidRow> = {}): ValidRow {
  return {
    rowNumber: 2,
    fullName: 'Placeholder One',
    batchYear: 2011,
    stream: 'B.Sc. Physics',
    currentOrg: 'Placeholder Industries',
    designation: 'Senior Analyst',
    previousRole: null,
    contact: SECRET_PHONE,
    gmail: SECRET_EMAIL,
    formEmail: SECRET_EMAIL,
    otherInfo: SECRET_TEXT,
    submittedAt: null,
    loginEmail: SECRET_EMAIL,
    ...overrides,
  };
}

describe('maskValue', () => {
  it('masks a phone number down to the last three digits', () => {
    const masked = maskValue('contact', SECRET_PHONE);
    assert.equal(masked, '+91 ••••• ••210');
    assert.ok(!masked.includes('9876543'));
  });

  it('masks an email down to its first character', () => {
    const masked = maskValue('gmail', SECRET_EMAIL);
    assert.ok(masked.startsWith('p•'));
    assert.ok(!masked.includes('laceholderone'));
  });

  it('shows free text as a length and never a prefix', () => {
    // This field is where health and family details hide. No prefix is safe.
    const masked = maskValue('otherInfo', SECRET_TEXT);
    assert.equal(masked, `«free text, ${SECRET_TEXT.length} characters»`);
    assert.ok(!masked.includes('Recovering'));
    assert.ok(!masked.includes('surgery'));
  });

  it('leaves public-tier fields readable, since the whole internet sees them anyway', () => {
    assert.equal(maskValue('fullName', 'Placeholder One'), 'Placeholder One');
    assert.equal(maskValue('currentOrg', 'Placeholder Industries'), 'Placeholder Industries');
    assert.equal(maskValue('batchYear', 2011), '2011');
  });

  it('renders an absent value as a dash rather than "null"', () => {
    assert.equal(maskValue('contact', null), '—');
    assert.equal(maskValue('otherInfo', ''), '—');
  });
});

describe('buildPreview', () => {
  it('never carries a secret into the rendered entries', () => {
    const plan = buildPlan([sheetRow()], new Map(), (e) => e, () => 'k3f9x2m7qp4w');
    const rendered = JSON.stringify(buildPreview(plan));

    for (const secret of [SECRET_PHONE, SECRET_EMAIL, SECRET_TEXT]) {
      assert.ok(!rendered.includes(secret), `preview leaked ${secret}`);
    }
    assert.ok(rendered.includes('Placeholder One'), 'the name is public and must stay legible');
  });

  it('masks both sides of a changed field', () => {
    const existing = new Map([
      [SECRET_EMAIL, {
        id: 'k3f9x2m7qp4w', loginHmacHex: SECRET_EMAIL,
        fullName: 'Placeholder One', batchYear: 2011, stream: 'B.Sc. Physics',
        currentOrg: 'Placeholder Industries', designation: 'Senior Analyst', previousRole: null,
        contact: '+919999999999', gmail: SECRET_EMAIL, formEmail: SECRET_EMAIL,
        otherInfo: SECRET_TEXT, ownerUpdatedAt: null,
      }],
    ]);
    const plan = buildPlan([sheetRow()], existing, (e) => e, () => 'unused');
    const entry = buildPreview(plan).entries[0]!;
    const change = entry.changes.find((c) => c.label.startsWith('Contact'))!;

    assert.equal(change.from, '+91 ••••• ••999');
    assert.equal(change.to, '+91 ••••• ••210');
  });
});

describe('assertNothingLeaked', () => {
  const plan = buildPlan([sheetRow()], new Map(), (e) => e, () => 'k3f9x2m7qp4w');

  it('passes a properly masked render', () => {
    assert.doesNotThrow(() => assertNothingLeaked('Placeholder One · +91 ••••• ••210', plan));
  });

  it('refuses to display a render containing a real number', () => {
    assert.throws(() => assertNothingLeaked(`row 2 ${SECRET_PHONE}`, plan), /masking bug/);
  });

  it('refuses to display a render containing a real address', () => {
    assert.throws(() => assertNothingLeaked(`<td>${SECRET_EMAIL}</td>`, plan), /masking bug/);
  });

  it('refuses to display a render containing the free-text field', () => {
    assert.throws(() => assertNothingLeaked(SECRET_TEXT, plan), /masking bug/);
  });
});
