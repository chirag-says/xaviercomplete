/**
 * /login
 *
 * Email, password and a six-digit code, all on one form and judged together.
 * There is no "password accepted, now your code" step: a two-stage flow tells
 * an attacker holding a leaked password that it is valid before they ever need
 * the phone, which turns two-factor into a password oracle.
 *
 * Every failure renders the same sentence. The only exception is a locked
 * account, which is told so — the holder needs to know to wait rather than keep
 * trying, and whoever triggered the lock already knows they did.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { signIn } from '@/lib/admin-auth';
import { currentAdmin, setAdminSessionCookie } from '@/lib/session-cookie';
import { clientIpHash, userAgent } from '@/lib/request';
import { consume, LIMITS } from '@/lib/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Sign in — SXCCAA Admin' };

const MESSAGES: Record<string, string> = {
  invalid: 'That email address, password or code was not right.',
  locked: 'Too many failed attempts. This account is locked for a short while — wait, then try again.',
  missing: 'Fill in all three fields.',
  signed_out: 'You have been signed out.',
  expired: 'Your session timed out. Sign in again.',
  throttled: 'Too many sign-in attempts from this connection. Wait an hour and try again.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  if (await currentAdmin()) redirect('/');

  const { e } = await searchParams;
  /*
   * `Object.hasOwn`, not a bare `MESSAGES[e]`.
   *
   * `e` comes from the query string, and a plain object literal inherits from
   * Object.prototype — so `/login?e=constructor` makes the bare lookup return a
   * *function*, which React refuses to render and which turns the sign-in page
   * into a server error for anyone handed that link. The own-property check
   * costs nothing and the only alternative is remembering never to index an
   * object with a string from a URL.
   */
  const notice = e && Object.hasOwn(MESSAGES, e) ? MESSAGES[e] : undefined;
  const isWarning = e === 'locked' || e === 'throttled';

  async function attempt(formData: FormData): Promise<void> {
    'use server';

    const email = formData.get('email');
    const password = formData.get('password');
    const totpCode = formData.get('code');
    const recoveryCode = formData.get('recovery');

    const hasSecond =
      (typeof totpCode === 'string' && totpCode.trim() !== '') ||
      (typeof recoveryCode === 'string' && recoveryCode.trim() !== '');

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || !hasSecond) {
      redirect('/login?e=missing');
    }

    const ipHash = await clientIpHash();

    /*
     * Spent before `signIn` is called, and that ordering matters twice over.
     *
     * It is what makes the limit an actual limit: `signIn` runs a full Argon2id
     * verify on every attempt including a miss — against a decoy hash when no
     * account matches, so the timing gives nothing away — and consuming the
     * token afterwards would mean the work is already done by the time we
     * decline to do it.
     *
     * It also keeps the throttle silent about who exists. The bucket is keyed by
     * connection and is charged before any lookup, so being throttled is a
     * statement about this IP and never about whether that address is an admin.
     *
     * The per-account lockout in admin-auth.ts stays exactly as it was. Neither
     * control replaces the other: an attacker with a botnet walks past a
     * per-account lockout, and an attacker with one connection walks past this.
     */
    if (!(await consume(ipHash, LIMITS.adminSignInIpHour)).allowed) {
      redirect('/login?e=throttled');
    }

    const result = await signIn(
      { email, password, totpCode, recoveryCode },
      { ipHash, userAgent: await userAgent() },
    );

    if (!result.ok) redirect(`/login?e=${result.reason === 'locked' ? 'locked' : 'invalid'}`);

    await setAdminSessionCookie(result.token, result.expiresAt);
    redirect(result.mustChangePassword ? '/account/password' : '/');
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <p className="eyebrow">SXCCAA</p>
        <h1>Admin portal</h1>
        <p className="auth__lede">
          This portal holds the contact details of every Xaverian in the directory. Sign in with your
          password and a code from your authenticator.
        </p>

        {notice && <div className={`notice notice--${isWarning ? 'warn' : 'error'}`}>{notice}</div>}

        <form action={attempt}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>

          <div className="field">
            <label htmlFor="code">Six-digit code</label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9\s]*"
              maxLength={9}
            />
            <p className="hint">From your authenticator app.</p>
          </div>

          <details className="field">
            <summary className="small muted" style={{ cursor: 'pointer' }}>
              Lost your phone?
            </summary>
            <div style={{ marginTop: 10 }}>
              <label htmlFor="recovery">Recovery code</label>
              <input id="recovery" name="recovery" type="text" autoComplete="off" placeholder="abcde-fghij" />
              <p className="hint">
                Works once, in place of the code above. You will be asked to set a new password and
                re-enrol your authenticator.
              </p>
            </div>
          </details>

          <div style={{ marginTop: 22 }}>
            <button className="btn" type="submit">Sign in</button>
          </div>
        </form>

        <p className="hint" style={{ marginTop: 22 }}>
          There is no password reset by email. If you are locked out, ask another super admin to send
          you a reset invitation — an admin mailbox is not a key to this portal.
        </p>
      </div>
    </main>
  );
}
