import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import {
  blindIndexOfNormalised,
  emailBlindIndex,
  ipBlindIndex,
  tokenHash,
  uaBlindIndex,
} from '../src/lib/core/hmac.ts';

const PEPPER = randomBytes(32);
const OTHER_PEPPER = randomBytes(32);

describe('emailBlindIndex', () => {
  it('produces a 32-byte index', () => {
    const result = emailBlindIndex('priya.menon@gmail.com', PEPPER);
    assert.ok(result.ok);
    assert.equal(result.hmac.length, 32);
  });

  it('is stable — the same address always lands on the same allowlist row', () => {
    const a = emailBlindIndex('priya.menon@gmail.com', PEPPER);
    const b = emailBlindIndex('priya.menon@gmail.com', PEPPER);
    assert.ok(a.ok && b.ok);
    assert.equal(a.hmac.toString('hex'), b.hmac.toString('hex'));
  });

  it('normalises first, so the sheet and the login form agree', () => {
    // This is the whole point: these four strings are one mailbox, so the
    // import and the login attempt must produce one index.
    const forms = [
      'priya.menon@gmail.com',
      'priyamenon@gmail.com',
      'Priya.Menon+alumni@googlemail.com',
      '  PRIYAMENON@GMAIL.COM ',
    ].map((raw) => emailBlindIndex(raw, PEPPER));

    for (const form of forms) assert.ok(form.ok);
    const hexes = new Set(forms.map((f) => (f.ok ? f.hmac.toString('hex') : '')));
    assert.equal(hexes.size, 1, 'all four spellings must hash to one index');
  });

  it('keeps genuinely different people apart', () => {
    const a = emailBlindIndex('priyamenon@gmail.com', PEPPER);
    const b = emailBlindIndex('priyamenon1@gmail.com', PEPPER);
    assert.ok(a.ok && b.ok);
    assert.notEqual(a.hmac.toString('hex'), b.hmac.toString('hex'));
  });

  it('is useless without the pepper — a stolen database cannot be tested against', () => {
    const withOurs = emailBlindIndex('priyamenon@gmail.com', PEPPER);
    const withTheirs = emailBlindIndex('priyamenon@gmail.com', OTHER_PEPPER);
    assert.ok(withOurs.ok && withTheirs.ok);
    assert.notEqual(withOurs.hmac.toString('hex'), withTheirs.hmac.toString('hex'));
  });

  it('passes the normalisation failure straight through', () => {
    const result = emailBlindIndex('not an address', PEPPER);
    assert.ok(!result.ok);
    assert.equal(result.reason, 'contains_whitespace');
  });

  it('reveals nothing recoverable — the index is not the address', () => {
    const result = emailBlindIndex('priyamenon@gmail.com', PEPPER);
    assert.ok(result.ok);
    const asText = result.hmac.toString('latin1');
    assert.ok(!asText.includes('priya'));
    assert.ok(!asText.includes('gmail'));
  });
});

describe('domain separation', () => {
  it('hashes the same string differently per purpose', () => {
    const value = '203.0.113.7';
    const asEmail = blindIndexOfNormalised(value, PEPPER).toString('hex');
    const asIp = ipBlindIndex(value, PEPPER).toString('hex');
    const asUa = uaBlindIndex(value, PEPPER).toString('hex');
    assert.equal(new Set([asEmail, asIp, asUa]).size, 3);
  });

  it('treats an IP consistently regardless of casing or padding', () => {
    assert.equal(
      ipBlindIndex(' 2001:DB8::1 ', PEPPER).toString('hex'),
      ipBlindIndex('2001:db8::1', PEPPER).toString('hex'),
    );
  });

  it('caps the user-agent it hashes so a giant header cannot be used as a lever', () => {
    assert.doesNotThrow(() => uaBlindIndex('x'.repeat(100_000), PEPPER));
  });
});

describe('tokenHash', () => {
  it('is stable and 32 bytes', () => {
    const token = randomBytes(32).toString('base64url');
    assert.equal(tokenHash(token).length, 32);
    assert.equal(tokenHash(token).toString('hex'), tokenHash(token).toString('hex'));
  });

  it('does not store the token itself', () => {
    const token = 'abcdefghijklmnop';
    assert.ok(!tokenHash(token).toString('latin1').includes(token));
  });

  it('refuses an empty token rather than hashing nothing', () => {
    assert.throws(() => tokenHash(''), TypeError);
  });
});
