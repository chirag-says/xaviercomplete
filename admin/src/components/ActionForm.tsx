'use client';

/**
 * A form that runs a server action and reports what happened, in place.
 *
 * Every mutation in the portal uses this, so success and failure look the same
 * everywhere and no action can fail silently. `useActionState` keeps the result
 * next to the control that caused it rather than in a toast that has gone by
 * the time you look up.
 *
 * `confirmText` puts a browser confirm in front of destructive actions. It is a
 * blunt instrument and it is the right one here: these are irreversible-ish
 * decisions about other people's access, taken a few times a month, where the
 * cost of a stray click is much higher than the cost of one extra keystroke.
 */

import { useActionState } from 'react';

import type { ActionResult } from '@/app/actions/admin-actions';

type Action = (prev: unknown, formData: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  submitLabel,
  variant = 'ghost',
  confirmText,
  inline = false,
  hidden,
}: {
  action: Action;
  children?: React.ReactNode;
  submitLabel: string;
  variant?: 'primary' | 'ghost' | 'danger';
  confirmText?: string;
  inline?: boolean;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => action(prev, formData),
    null,
  );

  const className =
    variant === 'primary' ? 'btn' : variant === 'danger' ? 'btn btn--danger btn--small' : 'btn btn--ghost btn--small';

  return (
    <form
      action={formAction}
      style={inline ? { display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } : undefined}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
      <button className={className} type="submit" disabled={pending}>
        {pending ? 'Working…' : submitLabel}
      </button>
      {state && (
        <span
          className="small"
          style={{ color: state.ok ? 'var(--good)' : 'var(--danger)', marginLeft: inline ? 4 : 0, display: inline ? 'inline' : 'block', marginTop: inline ? 0 : 8 }}
        >
          {state.ok ? state.message ?? 'Done.' : state.error}
        </span>
      )}
    </form>
  );
}
