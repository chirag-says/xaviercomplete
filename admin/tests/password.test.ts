/**
 * Password policy, hashing, and the breach check.
 *
 * The Argon2 tests are slow by design — 19 MiB and two iterations per call is
 * the point of the parameters, and a test suite that runs instantly would mean
 * the cost had been tuned away.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  assessPassword,
  checkPolicy,
  decoyPasswordHash,
  hashPassword,
  isBreached,
  MIN_LENGTH,
  secretEquals,
  verifyPassword,
} from '../src/lib/password.ts';
import { lockoutFor } from '../src/lib/admin-auth.ts';
import { isStepUpFresh, STEP_UP_WINDOW_MS } from '../src/lib/admin-session.ts';

describe('checkPolicy', () => {
  it('insists on length', () => {
    assert.equal(checkPolicy('x'.repeat(MIN_LENGTH)).ok, true);
    const short = checkPolicy('x'.repeat(MIN_LENGTH - 1));
    assert.equal(short.ok, false);
    assert.equal(short.ok === false && short.reason, 'too_short');
  });

  it('caps length, because Argon2 hashes whatever it is given', () => {
    // Not about strength. A megabyte-long password is a cheap way to make the
    // server do 19 MiB of work per request.
    const long = checkPolicy('x'.repeat(257));
    assert.equal(long.ok, false);
    assert.equal(long.ok === false && long.reason, 'too_long');
  });

  it('accepts a long passphrase with no symbols or digits', () => {
    // Deliberate: composition rules push people to "Password1!", which is both
    // compliant and in every cracking dictionary.
    assert.equal(checkPolicy('correct horse battery staple').ok, true);
  });

  it('rejects a non-string without throwing', () => {
    assert.equal(checkPolicy(undefined as unknown as string).ok, false);
    assert.equal(checkPolicy(12345678901234 as unknown as string).ok, false);
  });
});

describe('hashing', () => {
  it('round-trips', async () => {
    const encoded = await hashPassword('correct horse battery staple');
    assert.equal(await verifyPassword('correct horse battery staple', encoded), true);
    assert.equal(await verifyPassword('correct horse battery stapl', encoded), false);
  });

  it('uses Argon2id with the OWASP parameters', async () => {
    const encoded = await hashPassword('correct horse battery staple');
    assert.ok(encoded.startsWith('$argon2id$'), `not argon2id: ${encoded.slice(0, 20)}`);
    assert.ok(encoded.includes('m=19456'), 'memory cost should be 19 MiB');
    assert.ok(encoded.includes('t=2'), 'two iterations');
    assert.ok(encoded.includes('p=1'), 'one lane');
  });

  it('salts, so the same password hashes differently every time', async () => {
    const a = await hashPassword('the same password');
    const b = await hashPassword('the same password');
    assert.notEqual(a, b);
    assert.equal(await verifyPassword('the same password', a), true);
    assert.equal(await verifyPassword('the same password', b), true);
  });

  it('returns false rather than throwing on a corrupt stored hash', async () => {
    // A malformed hash in the database must be a failed sign-in, not a 500 —
    // and certainly not an exception whose message distinguishes "no such
    // admin" from "wrong password".
    for (const rubbish of ['', 'not-a-hash', '$argon2id$v=19$truncated']) {
      assert.equal(await verifyPassword('anything', rubbish), false);
    }
  });

  it('has a decoy hash that verifies against nothing', async () => {
    // The unknown-account path burns the same Argon2 work as a real one, or the
    // response time answers what the error message refuses to.
    const decoy = await decoyPasswordHash();
    assert.ok(decoy.startsWith('$argon2id$'));
    assert.equal(await verifyPassword('anything at all', decoy), false);
  });

  it('reuses the decoy rather than recomputing it', async () => {
    assert.equal(await decoyPasswordHash(), await decoyPasswordHash());
  });
});

describe('isBreached', () => {
  /** A canned range response in HIBP's `SUFFIX:COUNT` format. */
  const rangeResponse = (lines: string[]) =>
    (async () => ({ ok: true, text: async () => lines.join('\r\n') })) as unknown as typeof fetch;

  it('matches on the suffix of the SHA-1, never sending the password', async () => {
    // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    let requested = '';
    const spy = (async (url: string) => {
      requested = String(url);
      return { ok: true, text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:12345' };
    }) as unknown as typeof fetch;

    assert.equal(await isBreached('password', spy), true);
    // Asserted as an exact match rather than "does not contain the password".
    // The host is pwnedpasswords.com, so a substring check for "password" is
    // always true and proves nothing. This pins the whole URL: the five-character
    // prefix and not one character more.
    assert.equal(requested, 'https://api.pwnedpasswords.com/range/5BAA6');
  });

  it('ignores the zero-count padding entries HIBP adds', async () => {
    // With Add-Padding, HIBP returns decoy hashes with a count of 0. Treating
    // one as a hit would reject a perfectly good password.
    const padded = rangeResponse(['1E4C9B93F3F0682250B6CF8331B7EE68FD8:0']);
    assert.equal(await isBreached('password', padded), false);
  });

  it('returns false when the service is unreachable', async () => {
    // Fails open on purpose: a network problem at a third party should not stop
    // the Association creating an admin account. The length policy still holds.
    const dead = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    assert.equal(await isBreached('password', dead), false);
  });

  it('returns false on a non-200', async () => {
    const rateLimited = (async () => ({ ok: false, text: async () => '' })) as unknown as typeof fetch;
    assert.equal(await isBreached('password', rateLimited), false);
  });
});

describe('assessPassword', () => {
  it('applies the length rule before spending a network call', async () => {
    const verdict = await assessPassword('short');
    assert.equal(verdict.ok, false);
    assert.equal(verdict.ok === false && verdict.reason, 'too_short');
  });
});

describe('secretEquals', () => {
  it('compares in constant time and handles length mismatch', () => {
    assert.equal(secretEquals('abcdef', 'abcdef'), true);
    assert.equal(secretEquals('abcdef', 'abcdeg'), false);
    assert.equal(secretEquals('abc', 'abcdef'), false, 'different lengths must not throw');
    assert.equal(secretEquals('', ''), true);
  });
});

describe('lockoutFor', () => {
  it('does nothing below the threshold', () => {
    for (const attempts of [0, 1, 2, 3, 4]) assert.equal(lockoutFor(attempts), 0);
  });

  it('locks for fifteen minutes at the fifth failure, then doubles', () => {
    assert.equal(lockoutFor(5), 15 * 60 * 1000);
    assert.equal(lockoutFor(6), 30 * 60 * 1000);
    assert.equal(lockoutFor(7), 60 * 60 * 1000);
  });

  it('ceilings at an hour, so a long attack cannot lock an admin out for days', () => {
    for (const attempts of [8, 20, 500]) assert.equal(lockoutFor(attempts), 60 * 60 * 1000);
  });
});

describe('isStepUpFresh', () => {
  const at = (ms: number) => new Date(1_800_000_000_000 + ms);
  const session = (steppedUpAt: Date | null) => ({
    sessionId: 's',
    adminId: 'a',
    role: 'super_admin' as const,
    mustChangePassword: false,
    steppedUpAt,
  });

  it('is false when the holder has never re-authenticated this session', () => {
    assert.equal(isStepUpFresh(session(null), at(0)), false);
  });

  it('is true inside the window and false outside it', () => {
    assert.equal(isStepUpFresh(session(at(0)), at(STEP_UP_WINDOW_MS - 1)), true);
    assert.equal(isStepUpFresh(session(at(0)), at(STEP_UP_WINDOW_MS)), false);
    assert.equal(isStepUpFresh(session(at(0)), at(STEP_UP_WINDOW_MS + 60_000)), false);
  });

  it('is five minutes, as plan §9.3 says', () => {
    assert.equal(STEP_UP_WINDOW_MS, 5 * 60 * 1000);
  });
});
