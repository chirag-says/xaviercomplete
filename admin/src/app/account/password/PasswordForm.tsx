'use client';

/**
 * The change-password form.
 *
 * On success it does not redirect: the action has just revoked every session
 * including this one, so a redirect would land on the sign-in page with no
 * explanation. Saying what happened and offering the link is clearer than
 * being bounced.
 */

import { useActionState } from 'react';

import { changePassword, type ActionResult } from '@/app/actions/admin-actions';

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => changePassword(prev, formData),
    null,
  );

  if (state?.ok) {
    return (
      <>
        <div className="notice notice--good" style={{ marginTop: 16 }}>
          {state.message}
        </div>
        <a className="btn" href="/login">Sign in</a>
      </>
    );
  }

  return (
    <form action={formAction} style={{ marginTop: 16 }}>
      {state && !state.ok && <div className="notice notice--error">{state.error}</div>}

      <div className="field">
        <label htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>

      <div className="field">
        <label htmlFor="code">Six-digit code</label>
        <input id="code" name="code" type="text" inputMode="numeric" maxLength={9} required autoComplete="one-time-code" />
        <p className="hint">
          If you signed in moments ago, wait for your app to show the next code — each one works once.
        </p>
      </div>

      <div className="field">
        <label htmlFor="next">New password</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={12} />
        <p className="hint">At least 12 characters, and not one that appears in a public breach.</p>
      </div>

      <div className="field">
        <label htmlFor="confirm">Type the new one again</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </div>

      <button className="btn" type="submit" style={{ marginTop: 18 }} disabled={pending}>
        {pending ? 'Changing…' : 'Change password'}
      </button>
    </form>
  );
}
