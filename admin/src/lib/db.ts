/**
 * The admin portal's database connection.
 *
 * Connects as `sxc_admin` (0002_roles.sql), which can read and write the
 * directory, the allowlist, the admin tables and the access-request queue — and
 * can append to `audit_log` but never update or delete a row in it.
 *
 * It refuses to fall back to the owner credential. `DATABASE_URL` owns the
 * schema: with it, a bug in this application could drop a table or rewrite the
 * audit log, which is precisely what 0002 exists to make impossible. In
 * development the fallback is noisy rather than fatal, because the alternative
 * is that nobody runs the portal locally.
 */

import { connect, type Sql } from './shared.ts';

export type { Sql };

let shared: Sql | undefined;

export function adminDb(): Sql {
  if (!shared) {
    const url = process.env.ADMIN_DATABASE_URL;
    if (!url) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'ADMIN_DATABASE_URL is not set. The admin portal must connect as sxc_admin; it will not fall back to the owner credential.',
        );
      }
      console.warn('[db] ADMIN_DATABASE_URL is not set — falling back to DATABASE_URL. Never do this in production.');
    }
    shared = connect(url ?? process.env.DATABASE_URL ?? '', {
      // A handful of admins, not a public site.
      max: 3,
      application_name: 'sxccaa-admin',
    });
  }
  return shared;
}

export async function closeAdminDb(): Promise<void> {
  if (shared) {
    await shared.end({ timeout: 5 });
    shared = undefined;
  }
}
