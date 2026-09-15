/**
 * Change your own password.
 *
 * Outside the (portal) route group on purpose: an admin whose account was
 * created by someone else's reset is sent here and must not be able to browse
 * the directory first, so this page cannot sit behind the guard that redirects
 * to it.
 *
 * The current password and a live code are both required even though the
 * session already proves identity. A session left open on an unlocked machine
 * should not be enough to take the account over permanently.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PasswordForm } from './PasswordForm';
import { currentAdmin } from '@/lib/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Change password — SXCCAA Admin' };

export default async function PasswordPage() {
  const admin = await currentAdmin();
  if (!admin) redirect('/login?e=expired');

  return (
    <main className="auth">
      <div className="auth__card">
        <p className="eyebrow">SXCCAA</p>
        <h1>Change your password</h1>

        {admin.mustChangePassword ? (
          <div className="notice notice--warn" style={{ marginTop: 16 }}>
            Your password was set by someone else, or you signed in with a recovery code. Choose one
            only you know before going any further.
          </div>
        ) : (
          <p className="auth__lede">
            Every other session you have open will end, including on your other devices.
          </p>
        )}

        <PasswordForm />

        {!admin.mustChangePassword && (
          <p className="hint" style={{ marginTop: 20 }}>
            <a href="/">Back to the portal</a>
          </p>
        )}
      </div>
    </main>
  );
}
