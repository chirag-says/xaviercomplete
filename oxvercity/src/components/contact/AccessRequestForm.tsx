'use client';

/**
 * Requesting directory access — single-step form.
 *
 * Collects details and submits directly to the admin queue.
 * Turnstile provides bot protection; admin review provides identity verification.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

type FormState = 'form' | 'done';

export function AccessRequestForm({ siteKey }: { siteKey: string | null }) {
  const [formState, setFormState] = useState<FormState>('form');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState(false);

  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !widget.current) return;

    const render = () => {
      if (!window.turnstile || !widget.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(widget.current, { sitekey: siteKey, theme: 'light' });
    };

    if (window.turnstile) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [siteKey]);

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);

    try {
      const response = await fetch('/api/access-request', { method: 'POST', body: data });
      const result = (await response.json()) as { message?: string };

      setBusy(false);
      setNotice(result.message ?? 'Something went wrong. Please try again.');
      setProblem(!response.ok);

      if (response.ok) {
        setFormState('done');
      }
    } catch {
      setBusy(false);
      setNotice('We could not reach the server. Check your connection and try again.');
      setProblem(true);
    }

    window.turnstile?.reset(widgetId.current ?? undefined);
  }

  if (formState === 'done') {
    return (
      <div className="req-done">
        <h3 className="req-done__title">Your request is with the Association</h3>
        <p className="req-done__body">{notice}</p>
        <p className="req-done__body">
          A person reads every one of these — there is no automatic approval, and there never will be.
          If it is granted you will get an email telling you so, and can sign in from then on.
        </p>
      </div>
    );
  }

  return (
    <>
      <form className="req-form" onSubmit={submitDetails} noValidate>
        <div className="req-row">
          <div className="req-field">
            <label htmlFor="req-name">Your full name</label>
            <input id="req-name" name="name" type="text" required maxLength={120} autoComplete="name" disabled={busy} />
            <p className="req-hint">As the Association would have it on record.</p>
          </div>

          <div className="req-field">
            <label htmlFor="req-email">Email address</label>
            <input
              id="req-email"
              name="email"
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@gmail.com"
              disabled={busy}
            />
            <p className="req-hint">This becomes your sign-in address if your request is approved.</p>
          </div>
        </div>

        <div className="req-row">
          <div className="req-field">
            <label htmlFor="req-batch">Year you left St Xavier&rsquo;s</label>
            <input
              id="req-batch"
              name="batchYear"
              type="number"
              min={1900}
              max={2100}
              placeholder="2011"
              disabled={busy}
            />
          </div>

          <div className="req-field">
            <label htmlFor="req-stream">Stream of study</label>
            <input id="req-stream" name="stream" type="text" maxLength={120} placeholder="B.Com." disabled={busy} />
          </div>
        </div>

        <div className="req-field">
          <label htmlFor="req-reason">Anything that would help the Association place you</label>
          <textarea
            id="req-reason"
            name="reason"
            rows={3}
            maxLength={2000}
            placeholder="Department, roll number, a society you were part of, or why you are asking."
            disabled={busy}
          />
          <p className="req-hint">
            A person reads this. The more they can match against their records, the quicker it goes.
          </p>
        </div>

        {/* Invisible to a person; a bot that fills every field it finds fills this. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="one-time-code"
          aria-hidden="true"
          style={{ position: 'absolute', transform: 'scale(0)' }}
          defaultValue=""
        />

        {siteKey && <div className="req-turnstile" ref={widget} />}

        <button className="req-submit" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send my request'}
        </button>
      </form>

      {notice && (
        <p className={`req-notice${problem ? ' req-notice--problem' : ''}`} role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </>
  );
}
