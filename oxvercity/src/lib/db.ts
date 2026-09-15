/**
 * Postgres connection.
 *
 * Direct Postgres with a least-privilege role, not the Supabase service-role
 * key. The service-role key bypasses RLS and every grant in
 * db/migrations/0002_roles.sql, which is the opposite of what this design
 * wants: the whole point is that the public application physically cannot write
 * to `access_grant` or read an admin row, whatever a bug in it attempts.
 *
 * `postgres` (porsager) over `pg`: no transitive dependencies, and its tagged
 * template is parameterised by construction — `sql\`... where id = ${id}\``
 * sends a bind parameter, never interpolated text. Making the safe thing the
 * default syntax is worth more here than familiarity.
 */

import postgres, { type Sql } from 'postgres';

export type { Sql };

export interface ConnectOptions {
  /** Small pools by default: this is a directory for a few hundred people, not a marketplace. */
  max?: number;
  /** Label shown in pg_stat_activity, so a stuck connection is identifiable. */
  application_name?: string;
}

export function connect(url: string, options: ConnectOptions = {}): Sql {
  if (!url) {
    throw new Error('No database URL. Set DATABASE_URL (or INGEST_DATABASE_URL for the ingest tool).');
  }

  return postgres(url, {
    max: options.max ?? 5,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: { application_name: options.application_name ?? 'sxccaa' },
    // Notices are chatty and occasionally echo statement text. Nothing in this
    // system should be writing query text to a log.
    onnotice: () => {},
    transform: { undefined: null },
  });
}

let shared: Sql | undefined;

/**
 * The public application's connection, opened on first use.
 *
 * `WEB_DATABASE_URL` is the `sxc_web` role. `DATABASE_URL` is the owner and is
 * for migrations only — falling back to it would hand the internet-facing app
 * the ability to rename alumni, mint allowlist entries and rewrite the audit
 * log, which is exactly what 0002 exists to prevent. So the fallback is refused
 * in production and merely noisy in development.
 */
export function db(): Sql {
  if (!shared) {
    const web = process.env.WEB_DATABASE_URL;
    if (!web) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'WEB_DATABASE_URL is not set. The public site must connect as sxc_web; it will not fall back to the owner credential.',
        );
      }
      console.warn('[db] WEB_DATABASE_URL is not set — falling back to DATABASE_URL. Never do this in production.');
    }
    shared = connect(web ?? process.env.DATABASE_URL ?? '', { application_name: 'sxccaa-web' });
  }
  return shared;
}

export async function closeDb(): Promise<void> {
  if (shared) {
    await shared.end({ timeout: 5 });
    shared = undefined;
  }
}
