import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { SecretConfigError, parseKeyring } from '../src/lib/core/keys.ts';

const k = () => randomBytes(32).toString('base64');

describe('parseKeyring', () => {
  it('accepts a single key', () => {
    const ring = parseKeyring(`1:${k()}`);
    assert.equal(ring.current.version, 1);
    assert.equal(ring.byVersion.size, 1);
  });

  it('treats the highest version as current, whatever the order', () => {
    const ring = parseKeyring(`1:${k()}, 3:${k()} ,2:${k()}`);
    assert.equal(ring.current.version, 3);
    assert.equal(ring.byVersion.size, 3);
  });

  it('rejects a key that is not 32 bytes', () => {
    assert.throws(
      () => parseKeyring(`1:${randomBytes(31).toString('base64')}`),
      /must decode to exactly 32 bytes/,
    );
  });

  it('does not leak the key material in the error', () => {
    const short = randomBytes(31).toString('base64');
    try {
      parseKeyring(`1:${short}`);
      assert.fail('should have thrown');
    } catch (error) {
      assert.ok(!String((error as Error).message).includes(short));
    }
  });

  it('rejects a duplicated version, which would make rotation ambiguous', () => {
    assert.throws(() => parseKeyring(`1:${k()},1:${k()}`), /appears twice/);
  });

  it('rejects a version outside one byte', () => {
    assert.throws(() => parseKeyring(`0:${k()}`), /1–255/);
    assert.throws(() => parseKeyring(`256:${k()}`), /1–255/);
  });

  it('rejects malformed input rather than guessing', () => {
    assert.throws(() => parseKeyring(''), SecretConfigError);
    assert.throws(() => parseKeyring('   '), SecretConfigError);
    assert.throws(() => parseKeyring(k()), /version:base64key/);
    assert.throws(() => parseKeyring(`v1:${k()}`), /is not a key version/);
  });
});
