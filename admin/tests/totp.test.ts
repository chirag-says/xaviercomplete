/**
 * TOTP, against the official vectors.
 *
 * RFC 6238 Appendix B publishes expected codes for a known secret at known
 * times. An implementation that reproduces them is correct; one that does not
 * is wrong however plausible it looks — which is the whole reason for writing
 * this rather than trusting a package.
 *
 * The RFC's secret is the ASCII string "12345678901234567890"; its base32 form
 * is what an authenticator app would be given.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { base32Decode, base32Encode, groupForReading } from '../src/lib/base32.ts';
import { newTotpSecret, otpauthUri, totpAt, verifyTotp, STEP_SECONDS } from '../src/lib/totp.ts';

const RFC_SECRET_SHA1 = base32Encode(Buffer.from('12345678901234567890', 'utf8'));

describe('base32', () => {
  it('round-trips arbitrary bytes', () => {
    for (const sample of ['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) {
      const buffer = Buffer.from(sample, 'utf8');
      assert.deepEqual(base32Decode(base32Encode(buffer)), buffer, `failed on "${sample}"`);
    }
  });

  it('matches the RFC 4648 vectors', () => {
    assert.equal(base32Encode(Buffer.from('f', 'utf8')), 'MY');
    assert.equal(base32Encode(Buffer.from('fo', 'utf8')), 'MZXQ');
    assert.equal(base32Encode(Buffer.from('foo', 'utf8')), 'MZXW6');
    assert.equal(base32Encode(Buffer.from('foob', 'utf8')), 'MZXW6YQ');
    assert.equal(base32Encode(Buffer.from('fooba', 'utf8')), 'MZXW6YTB');
    assert.equal(base32Encode(Buffer.from('foobar', 'utf8')), 'MZXW6YTBOI');
  });

  it('forgives what a human typing off a screen does', () => {
    const expected = Buffer.from('foobar', 'utf8');
    assert.deepEqual(base32Decode('mzxw 6ytb oi'), expected, 'lowercase and spaces');
    assert.deepEqual(base32Decode('MZXW-6YTB-OI'), expected, 'hyphens');
    assert.deepEqual(base32Decode('MZXW6YTBOI======'), expected, 'padding');
  });

  it('refuses a character that is not in the alphabet', () => {
    // 0, 1, 8 and 9 are not base32 — silently dropping them would decode a
    // mistyped secret to a wrong key and produce codes that never match.
    for (const bad of ['MZXW0', 'MZXW1', 'MZXW8', 'MZ!W6']) {
      assert.throws(() => base32Decode(bad), /not a base32 character/);
    }
  });

  it('groups a secret into fours for reading aloud', () => {
    assert.equal(groupForReading('ABCDEFGHIJ'), 'ABCD EFGH IJ');
  });
});

describe('TOTP against RFC 6238 Appendix B', () => {
  // Every vector in the RFC's SHA-1 column. Times are seconds since the epoch.
  const VECTORS: Array<[seconds: number, code: string]> = [
    [59, '94287082'],
    [1_111_111_109, '07081804'],
    [1_111_111_111, '14050471'],
    [1_234_567_890, '89005924'],
    [2_000_000_000, '69279037'],
    [20_000_000_000, '65353130'],
  ];

  for (const [seconds, expected] of VECTORS) {
    it(`T=${seconds} gives ${expected}`, () => {
      assert.equal(totpAt(RFC_SECRET_SHA1, { now: seconds * 1000, digits: 8 }), expected);
    });
  }

  it('handles a counter above 2^32, where 32-bit arithmetic would silently wrap', () => {
    // T=20000000000 is step 666,666,666 — under 2^32. This one is not.
    const huge = 200_000_000_000_000;
    assert.doesNotThrow(() => totpAt(RFC_SECRET_SHA1, { now: huge, digits: 8 }));
    assert.notEqual(
      totpAt(RFC_SECRET_SHA1, { now: huge, digits: 8 }),
      totpAt(RFC_SECRET_SHA1, { now: 0, digits: 8 }),
      'a wrapped counter would collide with the epoch',
    );
  });
});

describe('verifyTotp', () => {
  const secret = newTotpSecret();
  const now = 1_800_000_000_000;

  it('accepts the current code', () => {
    const result = verifyTotp(secret, totpAt(secret, { now }), { now });
    assert.equal(result.ok, true);
  });

  it('accepts one step either side, for clock drift and slow typing', () => {
    for (const offset of [-STEP_SECONDS, STEP_SECONDS]) {
      const code = totpAt(secret, { now: now + offset * 1000 });
      assert.equal(verifyTotp(secret, code, { now }).ok, true, `offset ${offset}s should pass`);
    }
  });

  it('refuses two steps away', () => {
    for (const offset of [-2 * STEP_SECONDS, 2 * STEP_SECONDS]) {
      const code = totpAt(secret, { now: now + offset * 1000 });
      const result = verifyTotp(secret, code, { now });
      assert.equal(result.ok, false, `offset ${offset}s should fail`);
    }
  });

  it('refuses a replay of a code already used', () => {
    const code = totpAt(secret, { now });
    const first = verifyTotp(secret, code, { now });
    assert.equal(first.ok, true);
    assert.ok(first.ok && typeof first.step === 'number');

    const replay = verifyTotp(secret, code, { now, lastUsedStep: first.ok ? first.step : null });
    assert.equal(replay.ok, false);
    assert.equal(replay.ok === false && replay.reason, 'replayed');
  });

  it('refuses an older step even if it is inside the window', () => {
    // Someone who captured the previous code must not be able to use it after
    // the account has moved on.
    const current = Math.floor(now / 1000 / STEP_SECONDS);
    const previous = totpAt(secret, { now: now - STEP_SECONDS * 1000 });
    const result = verifyTotp(secret, previous, { now, lastUsedStep: current });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'replayed');
  });

  it('rejects malformed input without touching the secret', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', null, undefined, 123456, {}]) {
      const result = verifyTotp(secret, bad as unknown, { now });
      assert.equal(result.ok, false, `${JSON.stringify(bad)} should not verify`);
      assert.equal(result.ok === false && result.reason, 'malformed');
    }
  });

  it('accepts a code typed with spaces, as phones display it', () => {
    const code = totpAt(secret, { now });
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    assert.equal(verifyTotp(secret, spaced, { now }).ok, true);
  });

  it('refuses a correct code for a different secret', () => {
    const other = newTotpSecret();
    const result = verifyTotp(secret, totpAt(other, { now }), { now });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'mismatch');
  });
});

describe('enrolment', () => {
  it('mints 160-bit secrets, as RFC 4226 §4 requires', () => {
    assert.equal(base32Decode(newTotpSecret()).length, 20);
  });

  it('mints a different secret every time', () => {
    const secrets = new Set(Array.from({ length: 50 }, () => newTotpSecret()));
    assert.equal(secrets.size, 50);
  });

  it('builds an otpauth URI an authenticator app can read', () => {
    const secret = newTotpSecret();
    const uri = otpauthUri('admin@example.org', secret);
    assert.match(uri, /^otpauth:\/\/totp\//);
    assert.ok(uri.includes(`secret=${secret}`));
    assert.ok(uri.includes('digits=6'));
    assert.ok(uri.includes('period=30'));
    assert.ok(uri.includes('algorithm=SHA1'));
    assert.ok(uri.includes(encodeURIComponent('SXCCAA Admin:admin@example.org')));
  });
});
