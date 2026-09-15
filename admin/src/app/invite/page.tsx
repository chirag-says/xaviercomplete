/**
 * /invite?token=… — onboarding for an invited administrator.
 *
 * One sitting: set a password, enrol an authenticator, confirm a live code, and
 * receive ten recovery codes. The account is written only at the end, in one
 * transaction. Abandon it halfway and there is no account, no disabled row, no
 * placeholder — nothing to find and nothing to hijack.
 *
 * ## The TOTP secret travels in a hidden field, and that is deliberate
 *
 * It is generated on the server, shown to the invitee so they can enrol it, and
 * posted back with their confirmation code. Keeping it server-side instead
 * would mean stashing an unconfirmed secret somewhere — a session, a table —
 * and that is a row holding a second factor for an account that does not exist
 * yet. The secret is worthless without the password and the invitation token,
 * both of which the holder of this page already has.
 *
 * ## Every failure looks the same
 *
 * Expired, already used, invented: one neutral page. An invitation link is a URL
 * people forward and paste into chats; telling them apart would turn this page
 * into a way to test whether a given token — or a given admin — ever existed.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { emailBlindIndex } from '@/lib/shared';
import { peekInvite, redeemInvite } from '@/lib/invite';
import { assessPassword } from '@/lib/password';
import { createAdminAccount } from '@/lib/provision';
import { issueRecoveryCodes } from '@/lib/recovery';
import { groupForReading } from '@/lib/base32';
import { newTotpSecret, otpauthUri, verifyTotp } from '@/lib/totp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Set up your account — SXCCAA Admin' };

const PROBLEMS: Record<string, string> = {
  mismatch: 'The two passwords did not match.',
  weak: 'That password was refused. Use at least 12 characters, and not one that appears in a public breach.',
  code: 'That code did not match. Check your phone’s clock is set automatically, then try the current code.',
  missing: 'Fill in every field.',
};

function Dead() {
  return (
    <main className="auth">
      <div className="auth__card">
        <p className="eyebrow">SXCCAA</p>
        <h1>This invitation is no longer valid</h1>
        <p className="auth__lede">
          Invitations work once and expire after 24 hours. Ask a super admin to send a new one.
        </p>
        <a className="btn btn--ghost" href="/login">Go to sign in</a>
      </div>
    </main>
  );
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; secret?: string; e?: string; done?: string; codes?: string }>;
}) {
  const { token, secret: carried, e, done, codes } = await searchParams;

  // Final screen: the recovery codes, shown once.
  if (done === '1' && codes) {
    const list = codes.split(',').filter(Boolean);
    return (
      <main className="auth">
        <div className="auth__card auth__card--wide">
          <p className="eyebrow">SXCCAA</p>
          <h1>Your account is ready</h1>
          <p className="auth__lede">
            These recovery codes each work once, in place of your authenticator, if you lose your phone.
            Only their hashes are stored — nobody, including us, can show them to you again.
          </p>

          <div className="codes">
            {list.map((code) => (
              <span key={code}>{code}</span>
            ))}
          </div>

          <div className="notice notice--warn">
            Keep these somewhere other than the password manager holding your password. One place that
            is breached should not yield both factors.
          </div>

          <a className="btn" href="/login">I have saved them — sign in</a>
        </div>
      </main>
    );
  }

  const invite = await peekInvite(token ?? null);
  if (!invite) return <Dead />;

  // Generated once and carried through the form, so a failed confirmation does
  // not hand the invitee a different secret than the one they just enrolled.
  const secret = carried ?? newTotpSecret();

  async function complete(formData: FormData): Promise<void> {
    'use server';

    const rawToken = String(formData.get('token') ?? '');
    const totpSecret = String(formData.get('secret') ?? '');
    const password = formData.get('password');
    const confirm = formData.get('confirm');
    const code = formData.get('code');

    const back = (problem: string) =>
      `/invite?token=${encodeURIComponent(rawToken)}&secret=${encodeURIComponent(totpSecret)}&e=${problem}`;

    if (typeof password !== 'string' || !password || typeof code !== 'string' || !code) {
      redirect(back('missing'));
    }
    if (password !== confirm) redirect(back('mismatch'));

    const verdict = await assessPassword(password);
    if (!verdict.ok) redirect(back('weak'));

    // Checked before the token is spent: a wrong code must leave the invitation
    // usable, or one mistyped digit costs them the invitation.
    if (!verifyTotp(totpSecret, code).ok) redirect(back('code'));

    const redeemed = await redeemInvite(rawToken);
    if (!redeemed.ok) redirect('/invite');

    const identity = emailBlindIndex(redeemed.email);
    if (!identity.ok) redirect('/invite');

    const adminId = await createAdminAccount({
      normalisedEmail: identity.normalised,
      emailHmac: identity.hmac,
      password,
      totpSecret,
      role: redeemed.role,
      createdBy: redeemed.invitedBy,
    });

    const recovery = await issueRecoveryCodes(adminId);
    redirect(`/invite?done=1&codes=${encodeURIComponent(recovery.join(','))}`);
  }

  return (
    <main className="auth">
      <div className="auth__card auth__card--wide">
        <p className="eyebrow">SXCCAA</p>
        <h1>Set up your administrator account</h1>
        <p className="auth__lede">
          You have been invited as {invite.role === 'super_admin' ? 'a super admin' : 'a moderator'} for{' '}
          <strong>{invite.email}</strong>. This portal holds the contact details of every Xaverian in
          the directory, so both steps below are required.
        </p>

        {e && <div className="notice notice--error">{PROBLEMS[e] ?? 'Something was not right.'}</div>}

        <form action={complete}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="secret" value={secret} />

          <h2 style={{ marginTop: 8 }}>1. Choose a password</h2>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} />
            <p className="hint">
              At least 12 characters — a phrase you can remember beats a short string you cannot. It is
              checked against Have I Been Pwned; only a five-character hash prefix leaves this server,
              never the password.
            </p>
          </div>
          <div className="field">
            <label htmlFor="confirm">Type it again</label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </div>

          <h2 style={{ marginTop: 26 }}>2. Enrol your authenticator</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            Add this secret to 1Password, Aegis, Google Authenticator or any app that does TOTP, then
            type back the six-digit code it shows.
          </p>

          <div className="secret" style={{ margin: '12px 0' }}>{groupForReading(secret)}</div>
          <details style={{ marginBottom: 14 }}>
            <summary className="small muted" style={{ cursor: 'pointer' }}>Or use the setup URI</summary>
            <div className="secret small" style={{ marginTop: 8 }}>{otpauthUri(invite.email, secret)}</div>
          </details>

          <div className="field">
            <label htmlFor="code">Six-digit code</label>
            <input id="code" name="code" type="text" inputMode="numeric" maxLength={9} required autoComplete="one-time-code" />
          </div>

          <div className="notice" style={{ marginTop: 18 }}>
            Nothing is created until that code checks out. An account with unconfirmed two-factor is an
            account with no two-factor.
          </div>

          <button className="btn" type="submit" style={{ marginTop: 4 }}>Create my account</button>
        </form>
      </div>
    </main>
  );
}
