/**
 * Normalisation decides who can log in. A false negative here is an alumnus
 * telling the Association the site is broken; a false positive is one person
 * reaching another person's account. Both cases are covered below.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isGmail, maskEmail, normaliseEmail } from '../src/lib/core/email.ts';

function ok(raw: string): string {
  const result = normaliseEmail(raw);
  assert.ok(result.ok, `expected ${JSON.stringify(raw)} to be accepted`);
  return result.value;
}

function rejected(raw: unknown): string {
  const result = normaliseEmail(raw);
  assert.ok(!result.ok, `expected ${JSON.stringify(raw)} to be rejected`);
  return result.reason;
}

describe('normaliseEmail — the Gmail cases that lock people out', () => {
  it('treats dotted and undotted Gmail as the same mailbox', () => {
    assert.equal(ok('priya.menon@gmail.com'), ok('priyamenon@gmail.com'));
    assert.equal(ok('p.r.i.y.a.menon@gmail.com'), 'priyamenon@gmail.com');
  });

  it('strips the +tag', () => {
    assert.equal(ok('priya.menon+alumni@gmail.com'), 'priyamenon@gmail.com');
    assert.equal(ok('priyamenon+xavier+2011@gmail.com'), 'priyamenon@gmail.com');
  });

  it('collapses googlemail.com onto gmail.com', () => {
    assert.equal(ok('priya.menon@googlemail.com'), 'priyamenon@gmail.com');
  });

  it('handles the untidy way people type into a form', () => {
    assert.equal(ok('  Priya.Menon@GMail.COM  '), 'priyamenon@gmail.com');
  });

  it('is idempotent — normalising twice changes nothing', () => {
    const once = ok('Priya.Menon+alumni@googlemail.com');
    assert.equal(ok(once), once);
  });
});

describe('normaliseEmail — other providers', () => {
  it('lowercases but does not strip dots, which are significant elsewhere', () => {
    assert.equal(ok('Priya.Menon@Outlook.com'), 'priya.menon@outlook.com');
    assert.notEqual(ok('priya.menon@outlook.com'), ok('priyamenon@outlook.com'));
  });

  it('keeps the +tag outside Gmail, since not every provider subaddresses', () => {
    assert.equal(ok('priya+alumni@yahoo.co.in'), 'priya+alumni@yahoo.co.in');
  });

  it('accepts an institutional address', () => {
    assert.equal(ok('p.menon@sxc.edu.in'), 'p.menon@sxc.edu.in');
  });
});

describe('normaliseEmail — rejections', () => {
  it('rejects the obvious malformed cases', () => {
    assert.equal(rejected(''), 'empty');
    assert.equal(rejected('   '), 'empty');
    assert.equal(rejected('priya'), 'missing_local_or_domain');
    assert.equal(rejected('@gmail.com'), 'missing_local_or_domain');
    assert.equal(rejected('priya@'), 'missing_local_or_domain');
    assert.equal(rejected('priya@@gmail.com'), 'multiple_at_signs');
    assert.equal(rejected('priya menon@gmail.com'), 'contains_whitespace');
    assert.equal(rejected('priya@gmail'), 'domain_has_no_dot');
    assert.equal(rejected('priya@gmail..com'), 'malformed_domain');
    assert.equal(rejected('priya@-gmail.com'), 'malformed_domain');
    assert.equal(rejected('priya@gmail.com.'), 'malformed_domain');
    assert.equal(rejected('.priya@outlook.com'), 'malformed_local');
    assert.equal(rejected('pri..ya@outlook.com'), 'malformed_local');
  });

  it('rejects non-strings rather than coercing them', () => {
    assert.equal(rejected(null), 'not_a_string');
    assert.equal(rejected(undefined), 'not_a_string');
    assert.equal(rejected(42), 'not_a_string');
    assert.equal(rejected({ toString: () => 'a@b.com' }), 'not_a_string');
  });

  it('rejects an address longer than a mail server will accept', () => {
    assert.equal(rejected(`${'a'.repeat(250)}@gmail.com`), 'too_long');
    assert.equal(rejected(`${'a'.repeat(65)}@outlook.com`), 'local_too_long');
  });

  it('rejects a Gmail address that is only dots and a tag', () => {
    assert.equal(rejected('.+tag@gmail.com'), 'empty_local');
  });
});

describe('isGmail / maskEmail', () => {
  it('identifies the login-capable addresses', () => {
    assert.equal(isGmail(ok('priya.menon@googlemail.com')), true);
    assert.equal(isGmail(ok('p.menon@sxc.edu.in')), false);
  });

  it('masks enough that a screenshot of the dry-run leaks nothing', () => {
    const masked = maskEmail('priyamenon@gmail.com');
    assert.equal(masked, 'p•••••••••@gmail.com');
    assert.ok(!masked.includes('riyamenon'));
  });
});
