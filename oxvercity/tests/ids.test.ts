import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isAlumniId,
  newAlumniId,
  newOtp,
  newPhotoKey,
  newRecoveryCodes,
  newToken,
} from '../src/lib/core/ids.ts';

describe('newAlumniId', () => {
  it('is twelve characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const id = newAlumniId();
      assert.equal(id.length, 12);
      assert.match(id, /^[2-9a-km-np-z]{12}$/, id);
    }
  });

  it('never contains the characters people misread', () => {
    const sample = Array.from({ length: 500 }, newAlumniId).join('');
    for (const confusing of ['0', '1', 'l', 'o']) {
      assert.ok(!sample.includes(confusing), `id alphabet must exclude "${confusing}"`);
    }
  });

  it('does not repeat across a run far larger than the real dataset', () => {
    const ids = new Set(Array.from({ length: 20_000 }, newAlumniId));
    assert.equal(ids.size, 20_000);
  });

  it('reveals nothing about the record — it is not derived from anything', () => {
    // Belt and braces: the only way this could fail is if someone later
    // "improves" newAlumniId into a slug generator.
    assert.notEqual(newAlumniId(), newAlumniId());
  });
});

describe('isAlumniId', () => {
  it('accepts what it generates and rejects everything else', () => {
    assert.equal(isAlumniId(newAlumniId()), true);
    assert.equal(isAlumniId('priya-menon'), false);
    assert.equal(isAlumniId('k3f9x2m7qp4'), false, 'too short');
    assert.equal(isAlumniId('k3f9x2m7qp4ww'), false, 'too long');
    assert.equal(isAlumniId('k3f9x2m7qp40'), false, 'excluded character');
    assert.equal(isAlumniId('K3F9X2M7QP4W'), false, 'uppercase');
    assert.equal(isAlumniId(null), false);
    assert.equal(isAlumniId(123456789012), false);
  });
});

describe('tokens and codes', () => {
  it('mints URL-safe tokens with no padding to mangle in a link', () => {
    const token = newToken();
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    assert.equal(Buffer.from(token, 'base64url').length, 32);
  });

  it('mints six-digit OTPs including the ones with leading zeros', () => {
    const codes = Array.from({ length: 5000 }, newOtp);
    for (const code of codes) assert.match(code, /^\d{6}$/);
    assert.ok(codes.some((c) => c.startsWith('0')), 'leading zeros must survive');
  });

  it('mints photo keys unrelated to alumni ids', () => {
    const key = newPhotoKey();
    assert.equal(key.length, 22);
    assert.equal(isAlumniId(key), false);
  });

  it('mints ten distinct recovery codes', () => {
    const codes = newRecoveryCodes();
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10);
    for (const code of codes) assert.match(code, /^[2-9a-km-np-z]{5}-[2-9a-km-np-z]{5}$/);
  });
});
