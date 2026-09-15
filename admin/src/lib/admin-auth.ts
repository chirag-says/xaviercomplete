/**
 * Admin sign-in: password, then authenticator, then a session.
 *
 * ## One outcome for every kind of failure
 *
 * Unknown email, wrong password, disabled account, locked account, wrong code —
 * the caller gets `invalid_credentials` for all of them. Telling them apart
 * tells an attacker which half of the pair was right, and "this admin exists
 * but you have the wrong password" is the single most useful thing you can give
 * someone working through a list of addresses.
 *
 * The unknown-account path also verifies against a decoy hash, so it costs the
 * same ~50ms of Argon2 work as a real one. Without that, the response time
 * answers the question the error message refuses to.
 *
 * ## Why the password and the code are checked together
 *
 * There is no "password accepted, now enter your code" step that returns
 * anything to the client in between. A two-stage flow that confirms the
 * password before asking for the code turns 2FA into a password oracle: an
 * attacker with a leaked password learns it is valid without ever holding the
 * phone. Both are submitted at once and judged at once.
 *
 * ## Lockout
 *
 * Five failures locks the account for fifteen minutes, doubling each time to a
 * one-hour ceiling. The counter is per-account rather than per-IP because the
 * thing being protected is the account, and an attacker with a botnet has as
 * many IPs as they like.
 *
 * This does mean someone who knows an admin's address can lock them out on
 * purpose. That is a real cost, and it is the right trade for an account that
 * holds five hundred people's contact details: the recovery path is another
 * super admin or the local CLI, and neither is blocked by the lockout.
 */

import { adminDb, type Sql } from './db.ts';
import {
  audit,
  decryptField,
  emailBlindIndex,
  fieldContext,
  type MetaValue,
} from './shared.ts';
import { createAdminSession, revokeAllAdminSessions, type AdminRole } from './admin-session.ts';
import { decoyPasswordHash, hashPassword, verifyPassword } from './password.ts';
import { verifyTotp } from './totp.ts';
import { consumeRecoveryCode } from './recovery.ts';

const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 15 * 60 * 1000;
const MAX_LOCKOUT_MS = 60 * 60 * 1000;

export type SignInOutcome =
  | { ok: true; token: string; expiresAt: Date; adminId: string; role: AdminRole; mustChangePassword: boolean }
  | { ok: false; reason: 'invalid_credentials' | 'locked' };

interface AdminRow {
  id: string;
  email_enc: Buffer;
  password_hash: string;
  totp_secret_enc: Buffer;
  totp_confirmed_at: Date | null;
  totp_last_step: string | null;
  status: string;
  role: AdminRole;
  must_change_password: boolean;
  failed_attempts: number;
  locked_until: Date | null;
}

/** How long to lock after `attempts` consecutive failures. */
export function lockoutFor(attempts: number): number {
  if (attempts < MAX_ATTEMPTS) return 0;
  const doublings = attempts - MAX_ATTEMPTS;
  return Math.min(BASE_LOCKOUT_MS * 2 ** doublings, MAX_LOCKOUT_MS);
}

async function recordFailure(row: AdminRow, sql: Sql): Promise<void> {
  const attempts = row.failed_attempts + 1;
  const lockMs = lockoutFor(attempts);
  await sql`
    update admin_user
       set failed_attempts = ${attempts},
           locked_until = ${lockMs > 0 ? new Date(Date.now() + lockMs) : null}
     where id = ${row.id}
  `;
}

async function clearFailures(adminId: string, sql: Sql): Promise<void> {
  await sql`
    update admin_user set failed_attempts = 0, locked_until = null, last_login_at = now()
     where id = ${adminId}
  `;
}

/**
 * Sign in with email, password and a six-digit code.
 *
 * `recoveryCode` is an alternative to `totpCode` for someone who has lost their
 * phone. It is consumed on use and forces re-enrolment (plan §9.2).
 */
export async function signIn(
  credentials: { email: unknown; password: unknown; totpCode?: unknown; recoveryCode?: unknown },
  context: { ipHash?: Buffer | null; userAgent?: string | null } = {},
  sql: Sql = adminDb(),
): Promise<SignInOutcome> {
  const identity = emailBlindIndex(credentials.email);
  const password = typeof credentials.password === 'string' ? credentials.password : '';

  const rows = identity.ok
    ? await sql<AdminRow[]>`
        select id, email_enc, password_hash, totp_secret_enc, totp_confirmed_at, totp_last_step,
               status, role, must_change_password, failed_attempts, locked_until
          from admin_user
         where email_hmac = ${identity.hmac}
         limit 1
      `
    : [];

  const row = rows[0];

  // No such account, or a malformed address. Burn the same Argon2 work a real
  // attempt would, then give the same answer.
  if (!row) {
    await verifyPassword(password || 'x', await decoyPasswordHash());
    await audit(
      { actorType: 'anonymous', action: 'admin_sign_in_failed', ipHash: context.ipHash, meta: { reason: 'no_account' } },
      sql,
    );
    return { ok: false, reason: 'invalid_credentials' };
  }

  // A locked account is told it is locked. This is the one distinction worth
  // making: the holder needs to know to wait rather than to keep trying, and
  // an attacker who triggered the lock already knows they did.
  if (row.locked_until && row.locked_until > new Date()) {
    await audit(
      { actorType: 'admin', actorId: row.id, action: 'admin_sign_in_failed', ipHash: context.ipHash, meta: { reason: 'locked' } },
      sql,
    );
    return { ok: false, reason: 'locked' };
  }

  const usable = row.status === 'active' && row.totp_confirmed_at !== null;

  const passwordOk = await verifyPassword(password, row.password_hash);

  // The second factor is evaluated whatever the password did, so the two
  // branches cost the same and the response time says nothing.
  let secondFactorOk = false;
  let usedRecoveryCode = false;
  let matchedStep: number | null = null;

  const totpSecret = decryptField(row.totp_secret_enc, fieldContext('admin_user', row.id, 'totpSecret'));

  if (typeof credentials.recoveryCode === 'string' && credentials.recoveryCode.trim() !== '') {
    secondFactorOk = await consumeRecoveryCode(row.id, credentials.recoveryCode, sql);
    usedRecoveryCode = secondFactorOk;
  } else {
    const result = verifyTotp(totpSecret, credentials.totpCode, {
      lastUsedStep: row.totp_last_step === null ? null : Number(row.totp_last_step),
    });
    secondFactorOk = result.ok;
    matchedStep = result.ok ? result.step : null;
  }

  if (!passwordOk || !secondFactorOk || !usable) {
    await recordFailure(row, sql);
    await audit(
      {
        actorType: 'admin',
        actorId: row.id,
        action: 'admin_sign_in_failed',
        ipHash: context.ipHash,
        // Reason codes, never values. Useful to whoever reads the log, useless
        // to whoever is guessing — they never see this.
        meta: {
          password: passwordOk,
          second_factor: secondFactorOk,
          account_usable: usable,
        } satisfies Record<string, MetaValue>,
      },
      sql,
    );
    return { ok: false, reason: 'invalid_credentials' };
  }

  await clearFailures(row.id, sql);

  // Burn the TOTP step so the same code cannot be used again inside its window.
  if (matchedStep !== null) {
    await sql`update admin_user set totp_last_step = ${matchedStep} where id = ${row.id}`;
  }

  const session = await createAdminSession(row.id, context, sql);

  await audit(
    {
      actorType: 'admin',
      actorId: row.id,
      action: 'admin_signed_in',
      ipHash: context.ipHash,
      meta: { via: usedRecoveryCode ? 'recovery_code' : 'totp' },
    },
    sql,
  );

  return {
    ok: true,
    ...session,
    adminId: row.id,
    role: row.role,
    // A recovery code means the phone is gone, so re-enrolment is due — and the
    // password should be changed too, since a lost phone often travels with a
    // lost laptop.
    mustChangePassword: row.must_change_password || usedRecoveryCode,
  };
}

export type StepUpOutcome = { ok: true } | { ok: false; reason: 'invalid' | 'code_already_used' };

/**
 * Re-authenticate an existing session for a dangerous action.
 *
 * Deliberately does not create a session or touch the lockout counter: it is
 * checking that the person at the keyboard is still the account holder, not
 * granting new access. Failures are audited.
 *
 * ## Why this one distinguishes "already used" and sign-in does not
 *
 * An admin who signs in and immediately grants someone access will be asked for
 * a code while their phone is still showing the one they just used — and it
 * will be refused, because each code is single-use. Reporting that as "invalid"
 * sends people off to check their phone's clock over something that is working
 * as designed, so it gets its own outcome and its own message: wait for the
 * next code.
 *
 * Saying so is safe here and is not at sign-in. This caller already holds a
 * live session, so their identity is established and the distinction reveals
 * nothing. At sign-in it would confirm that the password was correct, which is
 * the one thing the opaque failure exists to hide.
 */
export async function stepUp(
  adminId: string,
  credentials: { password: unknown; totpCode: unknown },
  context: { ipHash?: Buffer | null } = {},
  sql: Sql = adminDb(),
): Promise<StepUpOutcome> {
  const rows = await sql<Array<Pick<AdminRow, 'id' | 'password_hash' | 'totp_secret_enc' | 'totp_last_step'>>>`
    select id, password_hash, totp_secret_enc, totp_last_step
      from admin_user
     where id = ${adminId} and status = 'active'
     limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, reason: 'invalid' };

  const password = typeof credentials.password === 'string' ? credentials.password : '';
  const passwordOk = await verifyPassword(password, row.password_hash);

  const secret = decryptField(row.totp_secret_enc, fieldContext('admin_user', row.id, 'totpSecret'));
  const totp = verifyTotp(secret, credentials.totpCode, {
    lastUsedStep: row.totp_last_step === null ? null : Number(row.totp_last_step),
  });

  if (!passwordOk || !totp.ok) {
    await audit(
      {
        actorType: 'admin',
        actorId: adminId,
        action: 'admin_step_up_failed',
        ipHash: context.ipHash,
        meta: { password: passwordOk, second_factor: totp.ok },
      },
      sql,
    );
    // Only tell them the code was already used when that is the *only* thing
    // wrong. If the password was also wrong, the generic message is the honest
    // one and does not hint that half the attempt succeeded.
    return {
      ok: false,
      reason: passwordOk && !totp.ok && totp.reason === 'replayed' ? 'code_already_used' : 'invalid',
    };
  }

  await sql`update admin_user set totp_last_step = ${totp.step} where id = ${adminId}`;
  await audit({ actorType: 'admin', actorId: adminId, action: 'admin_stepped_up', ipHash: context.ipHash }, sql);
  return { ok: true };
}

/**
 * Change an admin's own password.
 *
 * Every other session for the account is revoked. A password change is often
 * the response to "I think someone has my password"; leaving their sessions
 * alive would make it useless.
 */
export async function changeOwnPassword(
  adminId: string,
  newPassword: string,
  sql: Sql = adminDb(),
): Promise<void> {
  await sql`
    update admin_user
       set password_hash = ${await hashPassword(newPassword)},
           must_change_password = false
     where id = ${adminId}
  `;
  await revokeAllAdminSessions(adminId, sql);
  await audit({ actorType: 'admin', actorId: adminId, action: 'admin_password_changed' }, sql);
}
