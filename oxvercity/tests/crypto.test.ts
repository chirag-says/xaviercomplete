/**
 * The tests that matter most in this repo.
 *
 * The round trip is the easy half. The half that actually protects anyone is
 * the set of cases below that assert decryption *fails*: wrong cell, wrong
 * row, wrong table, edited byte, retired key. Those are the guarantees plan
 * §3.2 makes to the client, and this file is the only thing holding the build
 * to them.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import {
  CryptoIntegrityError,
  blobKeyVersion,
  decryptField,
  decryptOptional,
  encryptField,
  encryptOptional,
  fieldContext,
  needsReEncryption,
  secretEquals,
} from '../src/lib/core/crypto.ts';
import { parseKeyring, type Keyring } from '../src/lib/core/keys.ts';

function keyringOf(...versions: number[]): Keyring {
  return parseKeyring(
    versions.map((v) => `${v}:${randomBytes(32).toString('base64')}`).join(','),
    'TEST_KEYS',
  );
}

const KEYS = keyringOf(1);
const CONTACT = fieldContext('alumni', 'k3f9x2m7qp4w', 'contact');

describe('encryptField / decryptField', () => {
  it('round-trips a value', () => {
    const blob = encryptField('+919876543210', CONTACT, KEYS);
    assert.equal(decryptField(blob, CONTACT, KEYS), '+919876543210');
  });

  it('round-trips unicode and long free text', () => {
    const value = 'Worked at Ålesund Marine — 2011‑2014. नमस्ते 🙏 ' + 'x'.repeat(4000);
    const context = fieldContext('alumni', 'k3f9x2m7qp4w', 'other_info');
    assert.equal(decryptField(encryptField(value, context, KEYS), context, KEYS), value);
  });

  it('never emits the plaintext in the blob', () => {
    const blob = encryptField('+919876543210', CONTACT, KEYS);
    assert.ok(!blob.toString('latin1').includes('9876543210'));
    assert.ok(!blob.toString('utf8').includes('9876543210'));
  });

  it('produces a different blob every time, so equal values are not linkable', () => {
    const a = encryptField('same@gmail.com', CONTACT, KEYS);
    const b = encryptField('same@gmail.com', CONTACT, KEYS);
    assert.notEqual(a.toString('base64'), b.toString('base64'));
  });

  it('writes the current key version as the first byte', () => {
    const ring = keyringOf(1, 2, 7);
    assert.equal(blobKeyVersion(encryptField('x', CONTACT, ring)), 7);
  });
});

describe('AAD binding — the protection most implementations skip', () => {
  it('refuses a blob moved to a different field of the same row', () => {
    const blob = encryptField('+919876543210', CONTACT, KEYS);
    const otherField = fieldContext('alumni', 'k3f9x2m7qp4w', 'gmail');
    assert.throws(() => decryptField(blob, otherField, KEYS), CryptoIntegrityError);
  });

  it("refuses a blob copied into another alumnus's row", () => {
    const blob = encryptField('+919876543210', CONTACT, KEYS);
    const bob = fieldContext('alumni', 'zzzz11223344', 'contact');
    assert.throws(() => decryptField(blob, bob, KEYS), CryptoIntegrityError);
  });

  it('refuses a blob moved between tables', () => {
    const context = fieldContext('access_request', 'k3f9x2m7qp4w', 'email');
    const blob = encryptField('someone@gmail.com', context, KEYS);
    const elsewhere = fieldContext('alumni', 'k3f9x2m7qp4w', 'email');
    assert.throws(() => decryptField(blob, elsewhere, KEYS), CryptoIntegrityError);
  });

  it('refuses a blob whose version byte has been edited to force a key downgrade', () => {
    const ring = keyringOf(1, 2);
    const blob = encryptField('+919876543210', CONTACT, ring);
    blob[0] = 1;
    assert.throws(() => decryptField(blob, CONTACT, ring), CryptoIntegrityError);
  });

  it('rejects context parts containing a colon, which would let cells collide', () => {
    assert.throws(() => fieldContext('alumni', 'a:b', 'contact'), TypeError);
  });
});

describe('tamper detection', () => {
  it('refuses a blob with a flipped ciphertext bit', () => {
    const blob = encryptField('+919876543210', CONTACT, KEYS);
    blob[20] ^= 0x01;
    assert.throws(() => decryptField(blob, CONTACT, KEYS), CryptoIntegrityError);
  });

  it('refuses a blob with a flipped auth tag bit', () => {
    const blob = encryptField('+919876543210', CONTACT, KEYS);
    blob[blob.length - 1] ^= 0x01;
    assert.throws(() => decryptField(blob, CONTACT, KEYS), CryptoIntegrityError);
  });

  it('refuses a truncated blob', () => {
    const blob = encryptField('+919876543210', CONTACT, KEYS);
    assert.throws(() => decryptField(blob.subarray(0, 20), CONTACT, KEYS), CryptoIntegrityError);
  });

  it('refuses random bytes', () => {
    assert.throws(() => decryptField(randomBytes(64), CONTACT, KEYS), CryptoIntegrityError);
  });

  it('refuses a blob encrypted under a key we do not hold', () => {
    const theirs = keyringOf(1);
    const blob = encryptField('+919876543210', CONTACT, theirs);
    assert.throws(() => decryptField(blob, CONTACT, KEYS), CryptoIntegrityError);
  });
});

describe('key rotation', () => {
  it('reads old rows while writing new ones with the new key', () => {
    const v1 = parseKeyring('1:' + randomBytes(32).toString('base64'), 'TEST_KEYS');
    const oldBlob = encryptField('+919876543210', CONTACT, v1);

    // Deploy a second key alongside the first: same v1 bytes, plus a new v2.
    const bothRaw = `2:${randomBytes(32).toString('base64')},1:${v1.current.key.toString('base64')}`;
    const both = parseKeyring(bothRaw, 'TEST_KEYS');

    assert.equal(decryptField(oldBlob, CONTACT, both), '+919876543210');
    assert.equal(blobKeyVersion(encryptField('x', CONTACT, both)), 2);
    assert.equal(needsReEncryption(oldBlob, both), true);
  });

  it('reports a row as current once it has been rewritten', () => {
    const ring = keyringOf(1, 2);
    assert.equal(needsReEncryption(encryptField('x', CONTACT, ring), ring), false);
  });

  it('fails loudly when a key is retired before every row was rewritten', () => {
    const v1 = keyringOf(1);
    const stale = encryptField('+919876543210', CONTACT, v1);
    const afterRetirement = keyringOf(2);
    assert.throws(() => decryptField(stale, CONTACT, afterRetirement), /No key for version 1/);
  });
});

describe('optional fields', () => {
  it('stores nothing for a value that was never given', () => {
    assert.equal(encryptOptional(null, CONTACT, KEYS), null);
    assert.equal(encryptOptional(undefined, CONTACT, KEYS), null);
    assert.equal(encryptOptional('', CONTACT, KEYS), null);
    assert.equal(decryptOptional(null, CONTACT, KEYS), null);
  });

  it('still encrypts a present value', () => {
    const blob = encryptOptional('+919876543210', CONTACT, KEYS);
    assert.ok(Buffer.isBuffer(blob));
    assert.equal(decryptOptional(blob, CONTACT, KEYS), '+919876543210');
  });
});

describe('secretEquals', () => {
  it('matches identical buffers and rejects everything else', () => {
    const a = randomBytes(32);
    assert.equal(secretEquals(a, Buffer.from(a)), true);
    assert.equal(secretEquals(a, randomBytes(32)), false);
    assert.equal(secretEquals(a, randomBytes(16)), false, 'must not throw on a length mismatch');
    assert.equal(secretEquals(a, null as unknown as Buffer), false);
  });
});
