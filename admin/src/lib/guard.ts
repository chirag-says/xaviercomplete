/**
 * The checks every portal page and every action runs first.
 *
 * Three levels, each strictly stronger than the last:
 *
 *   requireAdmin      — a live session on an active account
 *   requireSuperAdmin — …and the super_admin role
 *   requireStepUp     — …and a re-authentication within the last five minutes
 *
 * They **throw or redirect** rather than returning a boolean. A helper that
 * returns `false` is a helper somebody forgets to check; one that never returns
 * on failure cannot be ignored. `requireAdmin` returns the session, so the
 * usual call is `const admin = await requireAdmin()` and there is no way to get
 * the session without having passed the check.
 *
 * ## Why the role is read from the database every time
 *
 * `readAdminSession` joins `admin_user` on every request, so demoting or
 * disabling an admin takes effect on their next click. Caching the role in the
 * cookie would be faster and would mean a removed admin kept their privileges
 * until the cookie expired — up to eight hours of access after the decision to
 * take it away.
 */

import { redirect } from 'next/navigation';

import { adminDb, type Sql } from './db.ts';
import { currentAdmin } from './session-cookie.ts';
import { isStepUpFresh, type AdminSession } from './admin-session.ts';

/** A live session, or a redirect to sign in. */
export async function requireAdmin(sql: Sql = adminDb()): Promise<AdminSession> {
  const admin = await currentAdmin(sql);
  if (!admin) redirect('/login');
  return admin;
}

/**
 * A live session whose owner must not be mid-forced-password-change.
 *
 * Used by every portal page except the change-password screen itself, so an
 * admin created by someone else's reset cannot browse the directory with a
 * password that person chose.
 */
export async function requireSettledAdmin(sql: Sql = adminDb()): Promise<AdminSession> {
  const admin = await requireAdmin(sql);
  if (admin.mustChangePassword) redirect('/account/password');
  return admin;
}

export async function requireSuperAdmin(sql: Sql = adminDb()): Promise<AdminSession> {
  const admin = await requireSettledAdmin(sql);
  if (admin.role !== 'super_admin') redirect('/?denied=role');
  return admin;
}

export class StepUpRequired extends Error {
  constructor() {
    super('This action needs you to confirm your password and a code.');
    this.name = 'StepUpRequired';
  }
}

/**
 * For the dangerous actions listed in plan §9.3: granting access, revoking
 * access, exporting, inviting an admin, re-enrolling TOTP.
 *
 * Throws rather than redirecting, because these run inside server actions where
 * the caller wants to render "confirm who you are" in place rather than lose
 * the form they had filled in.
 */
export async function requireStepUp(sql: Sql = adminDb()): Promise<AdminSession> {
  const admin = await requireSettledAdmin(sql);
  if (!isStepUpFresh(admin)) throw new StepUpRequired();
  return admin;
}

/** True when the session could perform a step-up action right now, for rendering. */
export async function canActNow(sql: Sql = adminDb()): Promise<boolean> {
  const admin = await currentAdmin(sql);
  return admin ? isStepUpFresh(admin) : false;
}
