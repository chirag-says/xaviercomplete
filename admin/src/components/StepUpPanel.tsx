'use client';

/**
 * "Confirm who you are" — the step-up gate (plan §9.3).
 *
 * Shown at the top of every screen that can grant or revoke access, so the
 * confirmation happens before the admin has made a decision rather than as an
 * interruption after it. Once confirmed it collapses to a line of text and
 * stays quiet for five minutes.
 */

import { useActionState } from 'react';

import { confirmIdentity, type ActionResult } from '@/app/actions/admin-actions';

export function StepUpPanel({ fresh }: { fresh: boolean }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => confirmIdentity(prev, formData),
    null,
  );

  if (fresh) {
    return (
      <div className="notice notice--good">
        Identity confirmed. Access decisions are unlocked for the next few minutes.
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card__head">
        <div>
          <h2>Confirm who you are</h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            Granting or revoking access needs your password and a current code, even though you are
            already signed in. A session left open on an unlocked screen should not be enough.
          </p>
        </div>
      </div>

      <form action={formAction} className="row" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label htmlFor="su-password">Password</label>
          <input id="su-password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <div style={{ flex: '0 1 150px' }}>
          <label htmlFor="su-code">Code</label>
          <input id="su-code" name="code" type="text" inputMode="numeric" maxLength={9} required />
        </div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? 'Checking…' : 'Confirm'}
        </button>
      </form>

      {state && !state.ok && <p className="small" style={{ color: 'var(--danger)', margin: '10px 0 0' }}>{state.error}</p>}
      {state?.ok && <p className="small" style={{ color: 'var(--good)', margin: '10px 0 0' }}>{state.message}</p>}
    </div>
  );
}
