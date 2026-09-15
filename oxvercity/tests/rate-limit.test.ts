/**
 * The token-bucket arithmetic.
 *
 * `refill()` is a transcription of the `least(capacity, tokens + elapsed *
 * rate)` expression inside the SQL in rate-limit.ts. Testing it here does not
 * prove the SQL is right, but it does pin the behaviour the SQL is supposed to
 * have — most importantly that a bucket cannot refill past its capacity, which
 * is what stops a month of inactivity from banking a month of attempts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LIMITS, perDay, perHour, refill, type Limit } from '../src/lib/rate-limit.ts';

const at = (seconds: number) => new Date(1_800_000_000_000 + seconds * 1000);
const bucket: Limit = { bucket: 'test', capacity: 3, refillPerSecond: perHour(3) };

describe('refill', () => {
  it('gives nothing back immediately', () => {
    assert.equal(refill(0, at(0), at(0), bucket), 0);
  });

  it('refills smoothly rather than in a lump at the hour', () => {
    // A fixed window would give 0 for 59 minutes then everything at once, which
    // is what lets an attacker burn two allowances either side of the boundary.
    assert.equal(refill(0, at(0), at(1200), bucket), 1, 'a third of an hour is one token');
    assert.equal(refill(0, at(0), at(2400), bucket), 2);
    assert.equal(refill(0, at(0), at(3600), bucket), 3);
  });

  it('never exceeds capacity, however long the bucket sat idle', () => {
    assert.equal(refill(0, at(0), at(86_400 * 30), bucket), 3, 'a month of quiet is still three attempts');
    assert.equal(refill(3, at(0), at(86_400), bucket), 3);
  });

  it('treats a clock that has gone backwards as no time passing', () => {
    // Clocks do move backwards — NTP corrections, a restored snapshot. Negative
    // elapsed time must not subtract tokens from someone.
    assert.equal(refill(2, at(100), at(0), bucket), 2);
  });

  it('accumulates from a partial balance', () => {
    assert.equal(refill(1, at(0), at(1200), bucket), 2);
  });
});

describe('the configured limits', () => {
  it('matches the figures in plan §6.3', () => {
    assert.equal(LIMITS.loginEmailHour.capacity, 3);
    assert.equal(LIMITS.loginEmailDay.capacity, 5);
    assert.equal(LIMITS.loginIpHour.capacity, 10);
    // Typing a code in is looser than asking for one: the hard stop on guessing
    // is `otp_attempts` on the row, not this.
    assert.equal(LIMITS.loginVerifyIpHour.capacity, 20);
    assert.equal(LIMITS.profileViewHour.capacity, 60);
    assert.equal(LIMITS.profileViewDay.capacity, 200);
    assert.equal(LIMITS.photoUploadDay.capacity, 5);
  });

  it('uses a separate bucket per limit, so hourly and daily both bind', () => {
    // One bucket cannot express "3 per hour AND 5 per day": the hourly refill
    // would hand out a sixth within the same day.
    const names = Object.values(LIMITS).map((limit) => limit.bucket);
    assert.equal(new Set(names).size, names.length, 'bucket names must be unique');
    assert.notEqual(LIMITS.loginEmailHour.bucket, LIMITS.loginEmailDay.bucket);
  });

  it('refills each limit over the period its name claims', () => {
    for (const limit of Object.values(LIMITS)) {
      const secondsToFull = limit.capacity / limit.refillPerSecond;
      const expected = limit.bucket.endsWith(':d') ? 86_400 : 3600;
      assert.equal(Math.round(secondsToFull), expected, limit.bucket);
    }
  });
});

describe('rate helpers', () => {
  it('converts counts into per-second rates', () => {
    assert.equal(perHour(3600), 1);
    assert.equal(perDay(86_400), 1);
  });
});
