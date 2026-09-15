'use server';

/**
 * Signing out revokes the session server-side, not just in the browser.
 *
 * Clearing the cookie alone would leave a usable token in anyone's hands who
 * had copied it — which is exactly the situation someone signing out on a
 * shared machine is trying to end.
 */

import { redirect } from 'next/navigation';

import { revokeAdminSession } from '@/lib/admin-session';
import { clearAdminSessionCookie, readAdminSessionCookie } from '@/lib/session-cookie';

export async function signOut(): Promise<void> {
  await revokeAdminSession(await readAdminSessionCookie());
  await clearAdminSessionCookie();
  redirect('/login?e=signed_out');
}
