/**
 * Recovery codes — the way back in when the authenticator is gone.
 *
 * Without these, a lost phone means a locked portal, and the only path back
 * runs through the local CLI on a developer's laptop. That is not an
 * operational plan for an Association whose admins are volunteers.
 *
 * ## Why they are hashed with Argon2id like passwords
 *
 * A recovery code is a password: a short secret a human holds, typed into a
 * login form. It is stronger than most (60 bits from `newRecoveryCodes`), but
 * it is stored in the same database as everything else, and a stolen dump full
 * of plaintext bypass codes would be worse than a stolen dump of password
 * hashes. The cost is that verification has to try each unused code in turn —
 * ten Argon2 verifications, about half a second, once in a blue moon.
 *
 * ## One use, and only ever ten
 *
 * A code is marked used inside the same statement that claims it, so two
 * simultaneous attempts cannot both win. Using one forces re-enrolment at the
 * next sign-in (see `signIn`), because a person who has reached for a recovery
 * code no longer has a working second factor.
 */

import { adminDb, type Sql } from './db.ts';
import { audit, newRecoveryCodes } from './shared.ts';
import { hashPassword, verifyPassword } from './password.ts';

export const CODE_COUNT = 10;

/**
 * Replace an admin's recovery codes and return the new ones in plaintext.
 *
 * The return value is the **only** time these strings exist outside a hash.
 * The caller shows them once and must not log, email or persist them.
 */
export async function issueRecoveryCodes(
  adminId: string,
  sql: Sql = adminDb(),
): Promise<string[]> {
  const codes = newRecoveryCodes(CODE_COUNT);

  // Hashing ten codes at 19 MiB each is ~500ms sequentially. Run them together;
  // this happens once per admin.
  const hashes = await Promise.all(codes.map((code) => hashPassword(code)));

  await sql.begin(async (tx) => {
    // Reissuing invalidates the old set. A code from a previous batch that
    // still worked would mean "I regenerated my codes" did not actually retire
    // the sheet of paper someone else might have.
    await tx`delete from admin_recovery_code where admin_id = ${adminId}`;
    for (const codeHash of hashes) {
      await tx`insert into admin_recovery_code (admin_id, code_hash) values (${adminId}, ${codeHash})`;
    }
  });

  await audit(
    { actorType: 'admin', actorId: adminId, action: 'admin_recovery_codes_issued', meta: { count: codes.length } },
    sql,
  );

  return codes;
}

/**
 * Spend one recovery code. Returns true if it was valid and unused.
 *
 * Every unused code is checked even after a match, so the time taken does not
 * reveal how far down the list the match was.
 */
export async function consumeRecoveryCode(
  adminId: string,
  candidate: unknown,
  sql: Sql = adminDb(),
): Promise<boolean> {
  if (typeof candidate !== 'string') return false;
  // Codes are printed as `abcde-fghij`; accept them typed without the hyphen
  // or in any case, since they are read off paper.
  const typed = candidate.trim().toLowerCase().replace(/\s/g, '');
  if (typed === '') return false;

  const rows = await sql<Array<{ id: string; code_hash: string }>>`
    select id, code_hash from admin_recovery_code
     where admin_id = ${adminId} and used_at is null
  `;

  let matchedId: string | null = null;
  for (const row of rows) {
    if (await verifyPassword(typed, row.code_hash)) matchedId = row.id;
  }
  if (!matchedId) return false;

  // `and used_at is null` in the WHERE makes the claim atomic: two racing
  // requests with the same code produce one winner and one zero-row update.
  const claimed = await sql`
    update admin_recovery_code set used_at = now()
     where id = ${matchedId} and used_at is null
    returning id
  `;
  if (claimed.length === 0) return false;

  const remaining = await countUnused(adminId, sql);
  await audit(
    { actorType: 'admin', actorId: adminId, action: 'admin_recovery_code_used', meta: { remaining } },
    sql,
  );

  return true;
}

export async function countUnused(adminId: string, sql: Sql = adminDb()): Promise<number> {
  const rows = await sql<Array<{ count: number }>>`
    select count(*)::int as count from admin_recovery_code
     where admin_id = ${adminId} and used_at is null
  `;
  return rows[0]?.count ?? 0;
}
