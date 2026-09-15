'use client';

/**
 * Requesting directory access: details, then the code from the email.
 *
 * ## Two steps, one page
 *
 * The form does not navigate between steps. Someone who has just typed their
 * details and is now reading a code off their phone should not be able to lose
 * the page by pressing back, and the address they entered has to still be on
 * screen so they can see which mailbox to look in.
 *
 * ## What this component will not do
 *
 * It never renders a different outcome for a registered and an unregistered
 * address. The server deliberately returns one sentence for both; showing a
 * green tick for one and a grey note for the other would undo that from the
 * client side, which is the easiest way to reopen a disclosure the backend was
 * careful to close.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';

type Step = 'details' | 'code' | 'done';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

export function AccessRequestForm({ siteKey }: { siteKey: string | null }) {
  const [step, setStep] = useState<Step>('details');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState(false);
  const [email, setEmail] = useState('');

  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

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

  // Moving to the code step puts the cursor where the next keystroke belongs.
  useEffect(() => {
    if (step === 'code') codeInput.current?.focus();
  }, [step]);

  async function post(url: string, body: FormData): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await fetch(url, { method: 'POST', body });
      const data = (await response.json()) as { message?: string };
      return { ok: response.ok, message: data.message ?? 'Something went wrong. Please try again.' };
    } catch {
      return { ok: false, message: 'We could not reach the server. Check your connection and try again.' };
    }
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);

    const typed = String(data.get('email') ?? '');
    const result = await post('/api/access-request', data);

    setBusy(false);
    setNotice(result.message);
    setProblem(!result.ok);
    if (result.ok) {
      setEmail(typed);
      setStep('code');
    }
    // A Turnstile token is single use; without a reset a second attempt fails
    // for a reason the visitor cannot see or act on.
    window.turnstile?.reset(widgetId.current ?? undefined);
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set('email', email);
    setBusy(true);

    const result = await post('/api/access-request/verify', data);

    setBusy(false);
    setNotice(result.message);
    setProblem(!result.ok);
    if (result.ok) setStep('done');
  }

  if (step === 'done') {
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
      {step === 'details' ? (
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
              <p className="req-hint">We send a code here, and this becomes your sign-in address.</p>
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
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
        </form>
      ) : (
        <form className="req-form" onSubmit={submitCode} noValidate>
          <p className="req-sent">
            We have sent a six-digit code to <strong>{email}</strong>. It expires in ten minutes.
          </p>

          <div className="req-field req-field--code">
            <label htmlFor="req-code">Six-digit code</label>
            <input
              id="req-code"
              name="code"
              ref={codeInput}
              type="text"
              inputMode="numeric"
              pattern="[0-9\s]*"
              maxLength={7}
              autoComplete="one-time-code"
              required
              disabled={busy}
            />
          </div>

          <div className="req-actions">
            <button className="req-submit" type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Verify and send my request'}
            </button>
            <button
              className="req-back"
              type="button"
              disabled={busy}
              onClick={() => {
                setStep('details');
                setNotice('');
                setProblem(false);
              }}
            >
              Use a different address
            </button>
          </div>
        </form>
      )}

      {notice && (
        <p className={`req-notice${problem ? ' req-notice--problem' : ''}`} role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </>
  );
}
