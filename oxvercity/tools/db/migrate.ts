/**
 * Apply the SQL migrations.
 *
 *   npm run db:migrate          apply anything not yet applied
 *   npm run db:migrate -- --status   list what has and has not run
 *
 * Exists because this machine has no `psql`. It does the same job: read the
 * files in order, run each one once, record that it ran. `db/migrations/*.sql`
 * remains plain SQL that psql can apply unchanged, so this runner is a
 * convenience and never the only way in.
 *
 * Connects as the owner (`DATABASE_URL` from the Supabase connection string).
 * That is the one place in this project where the owner credential is used —
 * the applications connect as the least-privilege roles that 0002 creates.
 *
 * Role passwords are read from the environment and never printed. If they are
 * absent this generates them, writes them into .env, and tells you to copy them
 * into your password manager. They are not echoed to the terminal: a password
 * in a scrollback is a password in a screenshot.
 */

import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';

import { connect } from '../../src/lib/db.ts';

const MIGRATIONS_DIR = 'db/migrations';

/** psql-style `:'name'` variables, resolved from these environment variables. */
const VARIABLES: Record<string, string> = {
  web_password: 'SXC_WEB_PASSWORD',
  admin_password: 'SXC_ADMIN_PASSWORD',
  ingest_password: 'SXC_INGEST_PASSWORD',
};

function die(message: string): never {
  process.stderr.write(`\n  ${message}\n\n`);
  process.exit(1);
}

/** Redact a connection URI for display. Splits on the last @, so an @ in the password is safe. */
function redact(url: string): string {
  const at = url.lastIndexOf('@');
  const colon = url.indexOf(':', url.indexOf('://') + 3);
  if (at === -1 || colon === -1 || colon > at) return '(unparseable url)';
  return `${url.slice(0, colon + 1)}****${url.slice(at)}`;
}

/**
 * Ensure the three role passwords exist, generating and persisting any that do
 * not. Nothing is written to stdout — the caller is told where to find them.
 */
function ensureRolePasswords(): { generated: string[] } {
  const generated: string[] = [];
  const lines: string[] = [];

  for (const variable of Object.values(VARIABLES)) {
    if (process.env[variable]) continue;
    // Base64url: no quote, backslash, @ or : to mis-parse inside a URI or SQL literal.
    const password = randomBytes(24).toString('base64url');
    process.env[variable] = password;
    lines.push(`${variable}=${password}`);
    generated.push(variable);
  }

  if (lines.length > 0) {
    appendFileSync('.env', `\n# Database role passwords, generated ${new Date().toISOString()}.\n${lines.join('\n')}\n`, {
      mode: 0o600,
    });
  }
  return { generated };
}

/** Substitute psql variables. Single quotes are doubled, which is how Postgres escapes them. */
function substitute(sqlText: string, file: string): string {
  return sqlText.replace(/:'([a-z_]+)'/g, (_match, name: string) => {
    const variable = VARIABLES[name];
    if (!variable) die(`${file} uses :'${name}', which this runner does not know about.`);
    const value = process.env[variable];
    if (!value) die(`${file} needs ${variable}, which is not set.`);
    return `'${value.replaceAll("'", "''")}'`;
  });
}

async function main(): Promise<void> {
  const statusOnly = process.argv.includes('--status');
  const url = process.env.DATABASE_URL ?? '';
  if (!url) die('DATABASE_URL is not set. Put the Supabase session connection string in .env.');

  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort();
  if (files.length === 0) die(`No .sql files in ${MIGRATIONS_DIR}.`);

  const sql = connect(url, { max: 1, application_name: 'sxccaa-migrate' });
  process.stdout.write(`\n  ${redact(url)}\n\n`);

  try {
    await sql`
      create table if not exists schema_migration (
        filename    text primary key,
        checksum    text not null,
        applied_at  timestamptz not null default now()
      )
    `;

    // Supabase grants every new table in `public` to anon and authenticated by
    // default, which means this ledger came up readable and writable over
    // PostgREST the first time it was created. 0003 fixes the default; this
    // closes the window for a fresh project where 0003 has not run yet.
    await sql`alter table schema_migration enable row level security`;
    for (const role of ['anon', 'authenticated']) {
      await sql.unsafe(
        `do $$ begin if exists (select 1 from pg_roles where rolname = '${role}') then
           revoke all on table schema_migration from ${role}; end if; end $$`,
      );
    }

    const applied = new Map(
      (await sql<Array<{ filename: string; checksum: string }>>`select filename, checksum from schema_migration`).map(
        (row) => [row.filename, row.checksum],
      ),
    );

    let ran = 0;

    for (const file of files) {
      const raw = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      // Checksum the file as written, before substitution — otherwise rotating a
      // role password would look like the migration had been edited.
      const checksum = createHash('sha256').update(raw).digest('hex').slice(0, 16);
      const previous = applied.get(file);

      if (previous) {
        const drifted = previous !== checksum;
        process.stdout.write(`  ${drifted ? '!' : '·'} ${file.padEnd(28)} ${drifted ? 'applied, but the file has changed since' : 'already applied'}\n`);
        if (drifted && !statusOnly) {
          die(
            `${file} was edited after it was applied.\n\n` +
              '  Migrations are immutable once run. Add a new numbered file instead —\n' +
              '  editing one that has already run means the database and the repo disagree\n' +
              '  and nobody can tell which is right.',
          );
        }
        continue;
      }

      if (statusOnly) {
        process.stdout.write(`  + ${file.padEnd(28)} pending\n`);
        continue;
      }

      if (ran === 0) ensureRolePasswords();
      process.stdout.write(`  → ${file.padEnd(28)} applying… `);

      // .simple() uses the simple query protocol, which is what allows a file of
      // many statements — including its own begin/commit — to run as one unit.
      await sql.unsafe(substitute(raw, file)).simple();
      await sql`insert into schema_migration (filename, checksum) values (${file}, ${checksum})`;

      process.stdout.write('done\n');
      ran++;
    }

    if (statusOnly) {
      process.stdout.write('\n');
      return;
    }

    process.stdout.write(ran === 0 ? '\n  Nothing to apply.\n\n' : `\n  Applied ${ran} migration${ran === 1 ? '' : 's'}.\n\n`);

    const { generated } = ensureRolePasswords();
    if (generated.length > 0) {
      process.stdout.write(
        `  Role passwords were generated and written to .env: ${generated.join(', ')}.\n` +
          '  They are not printed here on purpose. Open .env, copy them into your password\n' +
          '  manager, and build the application connection strings from them.\n\n',
      );
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  process.stderr.write(`\n  ${(error as Error).message}\n\n`);
  process.exit(1);
});
