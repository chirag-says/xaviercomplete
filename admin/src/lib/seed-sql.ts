/**
 * Building the admin seed query.
 *
 * Split out of `tools/admin-sql.ts` so the SQL can be tested without driving a
 * chain of interactive prompts. The CLI collects the inputs and prints what
 * this returns; everything that could be wrong about the query is in here.
 *
 * ## The two escaping rules, and why they are the whole of it
 *
 * Every value in the generated query is either a `bytea` or a text literal:
 *
 *   - **bytea** is emitted as `decode('<hex>', 'hex')`. Hex has no characters
 *     that mean anything to the SQL parser, so there is nothing to escape. The
 *     alternative, `E'\\x…'`, depends on `standard_conforming_strings` and on
 *     the escaping surviving however the string reaches the editor — two more
 *     things to be wrong about for no gain.
 *   - **text** is single-quoted with `'` doubled. That is the entire rule for a
 *     Postgres string literal.
 *
 * The inputs are not arbitrary anyway — a normalised email, an Argon2id hash, a
 * uuid and a role from a closed set — but the escaping is applied regardless,
 * because "this input cannot contain a quote" is exactly the assumption that
 * stops being true later.
 */

import type { AdminRole } from './admin-session.ts';

export interface SeedInput {
  /** Chosen by the caller, because the ciphertext is bound to it as AAD. */
  adminId: string;
  /** Already normalised, as `emailBlindIndex` returns it. */
  normalisedEmail: string;
  emailEnc: Buffer;
  emailHmac: Buffer;
  /** Argon2id encoded string. */
  passwordHash: string;
  totpSecretEnc: Buffer;
  role: AdminRole;
  /** Argon2id hashes of the ten recovery codes. */
  recoveryHashes: string[];
  /** Stamped into the header comment so a stale query is recognisable. */
  generatedAt: string;
}

/** `decode('ab12…', 'hex')` — no escaping to get wrong. */
export function bytea(buffer: Buffer): string {
  return `decode('${buffer.toString('hex')}', 'hex')`;
}

/** A Postgres string literal. Doubling the quote is the whole rule. */
export function sqlText(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildSeedSql(input: SeedInput): string {
  const id = sqlText(input.adminId);

  return `-- SXCCAA admin portal — seed one administrator.
-- Generated ${input.generatedAt} by \`npm run admin:sql\`.
--
-- Run this once, in the Supabase SQL editor. It creates exactly one account.
--
-- It contains an Argon2id password hash and AES-256-GCM ciphertext. There is no
-- readable password and no readable email address in it — which matters,
-- because the SQL editor keeps a query history.
--
-- The id below is a literal rather than gen_random_uuid(). The encrypted
-- columns are bound to it as additional authenticated data, so it had to be
-- known before they were computed. Changing it here will make them undecryptable.

begin;

-- Replacing an existing account with this address? Uncomment these two.
-- Nothing else will let the insert through: email_hmac is unique.
--
-- delete from admin_recovery_code
--  where admin_id in (select id from admin_user where email_hmac = ${bytea(input.emailHmac)});
-- delete from admin_user where email_hmac = ${bytea(input.emailHmac)};

insert into admin_user (
  id, email_enc, email_hmac, password_hash, totp_secret_enc,
  totp_confirmed_at, status, role, must_change_password
) values (
  ${id}::uuid,
  ${bytea(input.emailEnc)},
  ${bytea(input.emailHmac)},
  ${sqlText(input.passwordHash)},
  ${bytea(input.totpSecretEnc)},
  -- Set because a live code was typed back before this query was printed. The
  -- schema refuses an active admin without it (admin_active_requires_totp).
  now(),
  'active',
  ${sqlText(input.role)},
  false
);

-- Ten single-use codes, for a lost phone. Only their Argon2id hashes are here;
-- the codes themselves were printed once by the generator and cannot be
-- recovered from this file.
insert into admin_recovery_code (admin_id, code_hash) values
${input.recoveryHashes.map((hash) => `  (${id}::uuid, ${sqlText(hash)})`).join(',\n')};

-- Ids and a reason code. An audit row that names the person it describes is a
-- second copy of the data nobody is watching.
insert into audit_log (actor_type, actor_id, action, target_type, target_id, meta)
values ('system', 'admin:sql', 'admin_created', 'admin_user', ${id},
        jsonb_build_object('role', ${sqlText(input.role)}, 'via', 'seed_query'));

commit;`;
}
