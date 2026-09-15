import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { maskPhone, normalisePhone } from '../src/lib/core/phone.ts';

function ok(raw: unknown): string | null {
  const result = normalisePhone(raw);
  assert.ok(result.ok, `expected ${JSON.stringify(raw)} to be accepted`);
  return result.value;
}

function rejected(raw: unknown): string {
  const result = normalisePhone(raw);
  assert.ok(!result.ok, `expected ${JSON.stringify(raw)} to be rejected`);
  return result.reason;
}

describe('normalisePhone — the shapes a Google Form actually returns', () => {
  it('accepts a bare Indian mobile', () => {
    assert.equal(ok('9876543210'), '+919876543210');
  });

  it('accepts the same number however it was punctuated', () => {
    for (const written of [
      '+91 98765 43210',
      '+91-98765-43210',
      '(+91) 98765 43210',
      '91 9876543210',
      '09876543210',
      '0091 9876543210',
      '  9876543210  ',
      '+919876543210',
    ]) {
      assert.equal(ok(written), '+919876543210', written);
    }
  });

  it('accepts a number Excel handed back as a number, losing the leading zero', () => {
    assert.equal(ok(9876543210), '+919876543210');
  });

  it('accepts an international number as typed', () => {
    assert.equal(ok('+44 7700 900123'), '+447700900123');
    assert.equal(ok('+1 (415) 555-0142'), '+14155550142');
  });
});

describe('normalisePhone — "I would rather not say"', () => {
  it('stores nothing for every way people decline', () => {
    for (const written of ['', '  ', 'NA', 'na', 'N/A', 'n.a.', 'Nil', 'none', '-', '--', 'Not Applicable', null, undefined]) {
      assert.equal(ok(written), null, String(written));
    }
  });
});

describe('normalisePhone — rejections the dry-run should surface', () => {
  it('rejects numbers that cannot be dialled', () => {
    assert.equal(rejected('12345'), 'too_short');
    assert.equal(rejected('1234567890'), 'not_an_indian_mobile');
    assert.equal(rejected('+98765432101234567'), 'too_long', 'past the 15 digits E.164 allows');
    assert.equal(rejected('98765432101234567'), 'unrecognised_format', 'no + and no domestic shape');
    assert.equal(rejected('98765 43210 (office)'), 'contains_letters');
    assert.equal(rejected('++++'), 'no_digits');
    assert.equal(rejected({}), 'not_a_string');
  });

  it('rejects an eleven-digit number that is not trunk-prefixed', () => {
    assert.equal(rejected('19876543210'), 'unrecognised_format');
  });
});

describe('maskPhone', () => {
  it('shows the country code and the last three digits, nothing else', () => {
    assert.equal(maskPhone('+919876543210'), '+91 ••••• ••210');
    assert.ok(!maskPhone('+919876543210').includes('9876543'));
  });
});
