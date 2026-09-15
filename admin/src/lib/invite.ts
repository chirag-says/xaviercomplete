/**
 * Admin invitations — the only way an account comes into existence after the first.
 *
 * There is no public sign-up page and there never will be (plan §14). A super
 * admin names an address, the system mints a single-use token, and the invitee
 * sets a password and enrols an authenticator in one sitting. Until they
 * confirm a live code the account does not exist at all — not as a disabled
 * row, not as a placeholder. Nothing to find, nothing to hijack.
 *
 * ## Why the outcome is the same for expired, used and invented
 *
 * `redeemInvite` reports `invalid` for all three. An invitation link is a URL
 * people forward, screenshot and paste into chats; distinguishing "this
 * expired" from "this was never real" would turn the onboarding page into a way
 * to test whether a given token — or, by extension, a given admin address —
 * ever existed.
 *
 * ## Single use is enforced in SQL
 *
 * The statement that stamps `consumed_at` requires it to still be null, so two
 * simultaneous clicks produce one winner and one zero-row update. Doing that
 * check in JavaScript would leave a window in which both succeed and two
 * accounts are created from one invitation.
 */

import { adminDb, type Sql } from './db.ts';
import { audit, encryptField, decryptField, fieldContext, newToken, tokenHash } from './shared.ts';
import type { AdminRole } from './admin-session.ts';

export const INVITE_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface PendingInvite {
  id: string;
  email: string;
  role: AdminRole;
  expiresAt: Date;
}

/**
 * Create an invitation and return the raw token for the emailed link.
 *
 * Only the SHA-256 is stored, so a database leak yields no usable invitations.
 * The caller must have passed a step-up check — inviting an admin is as
 * dangerous as granting directory access, and is gated the same way.
 */
export async function createInvite(
  invitedBy: string,
  normalisedEmail: string,
  emailHmac: Buffer,
  role: AdminRole,
  sql: Sql = adminDb(),
): Promise<{ id: string; token: string; expiresAt: Date } | { error: 'already_an_admin' | 'already_invited' }> {
  const existing = await sql<Array<{ id: string }>>`
    select id from admin_user where email_hmac = ${emailHmac} limit 1
  `;
  if (existing.length > 0) return { error: 'already_an_admin' };

  const outstanding = await sql<Array<{ id: string }>>`
    select id from admin_invite
     where email_hmac = ${emailHmac} and consumed_at is null and expires_at > now()
     limit 1
  `;
  if (outstanding.length > 0) return { error: 'already_invited' };

  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_LIFETIME_MS);

  const rows = await sql<Array<{ id: string }>>`
    insert into admin_invite (email_enc, email_hmac, token_hash, invited_by, role, expires_at)
    values (
      ${encryptField(normalisedEmail, fieldContext('admin_invite', 'pending', 'email'))},
      ${emailHmac}, ${tokenHash(token)}, ${invitedBy}, ${role}, ${expiresAt}
    )
    returning id
  `;
  const id = rows[0]!.id;

  // Rebind the ciphertext to the row it actually landed in (plan §3.2).
  await sql`
    update admin_invite
       set email_enc = ${encryptField(normalisedEmail, fieldContext('admin_invite', id, 'email'))}
     where id = ${id}
  `;

  await audit(
    {
      actorType: 'admin',
      actorId: invitedBy,
      action: 'admin_invited',
      targetType: 'admin_invite',
      targetId: id,
      meta: { role },
    },
    sql,
  );

  return { id, token, expiresAt };
}

/**
 * Look up a token without spending it, for rendering the onboarding form.
 *
 * Returns null for expired, consumed and invented alike. The caller shows one
 * neutral "this invitation is no longer valid" page for all of them.
 */
export async function peekInvite(rawToken: string | null, sql: Sql = adminDb()): Promise<PendingInvite | null> {
  if (!rawToken) return null;

  const rows = await sql<Array<{ id: string; email_enc: Buffer; role: AdminRole; expires_at: Date }>>`
    select id, email_enc, role, expires_at from admin_invite
     where token_hash = ${tokenHash(rawToken)} and consumed_at is null and expires_at > now()
     limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  try {
    return {
      id: row.id,
      email: decryptField(row.email_enc, fieldContext('admin_invite', row.id, 'email')),
      role: row.role,
      expiresAt: row.expires_at,
    };
  } catch {
    // A blob that will not authenticate is a tampered or mis-keyed row. Treat
    // it as no invitation rather than as an error the visitor can interpret.
    return null;
  }
}

export type RedeemOutcome =
  | { ok: true; inviteId: string; email: string; emailHmac: Buffer; role: AdminRole; invitedBy: string }
  | { ok: false; reason: 'invalid' };

/**
 * Spend an invitation.
 *
 * Call this only once the password and a live TOTP code are in hand: consuming
 * the token and then failing to create the account would leave the invitee with
 * a dead link and no way back in without a new invitation.
 */
export async function redeemInvite(rawToken: string | null, sql: Sql = adminDb()): Promise<RedeemOutcome> {
  if (!rawToken) return { ok: false, reason: 'invalid' };

  const rows = await sql<
    Array<{ id: string; email_enc: Buffer; email_hmac: Buffer; role: AdminRole; invited_by: string }>
  >`
    update admin_invite
       set consumed_at = now()
     where token_hash = ${tokenHash(rawToken)}
       and consumed_at is null
       and expires_at > now()
    returning id, email_enc, email_hmac, role, invited_by
  `;
  const row = rows[0];
  if (!row) return { ok: false, reason: 'invalid' };

  try {
    return {
      ok: true,
      inviteId: row.id,
      email: decryptField(row.email_enc, fieldContext('admin_invite', row.id, 'email')),
      emailHmac: Buffer.from(row.email_hmac),
      role: row.role,
      invitedBy: row.invited_by,
    };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** Outstanding invitations, for the admin users screen. Addresses are decrypted for display. */
export async function listPendingInvites(
  sql: Sql = adminDb(),
): Promise<Array<{ id: string; email: string; role: AdminRole; expiresAt: Date }>> {
  const rows = await sql<Array<{ id: string; email_enc: Buffer; role: AdminRole; expires_at: Date }>>`
    select id, email_enc, role, expires_at from admin_invite
     where consumed_at is null and expires_at > now()
     order by expires_at
  `;

  return rows.flatMap((row) => {
    try {
      return [
        {
          id: row.id,
          email: decryptField(row.email_enc, fieldContext('admin_invite', row.id, 'email')),
          role: row.role,
          expiresAt: row.expires_at,
        },
      ];
    } catch {
      return [];
    }
  });
}

/** Withdraw an invitation that has not been used. */
export async function revokeInvite(inviteId: string, by: string, sql: Sql = adminDb()): Promise<boolean> {
  const rows = await sql`
    update admin_invite set consumed_at = now()
     where id = ${inviteId} and consumed_at is null
    returning id
  `;
  if (rows.length === 0) return false;

  await audit(
    { actorType: 'admin', actorId: by, action: 'admin_invite_revoked', targetType: 'admin_invite', targetId: inviteId },
    sql,
  );
  return true;
}
