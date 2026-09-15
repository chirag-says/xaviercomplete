'use client';

/**
 * The sign-in form: address, then the code from the email.
 *
 * ## The behaviour worth stating plainly
 *
 * **Every outcome that could reveal whether an address is registered renders
 * identically.** Same wording, same styling, same timing — and, the part that
 * is easy to get wrong here, **the same next step**. A form that advanced to
 * the code box for a Xaverian and stayed put for everybody else would announce
 * membership through its own layout, having been handed a response that was
 * careful not to. So a 200 moves to the code step, always, and someone who is
 * not on the allowlist waits for a code that was never sent and is eventually
 * told the code is wrong.
 *
 * That is a slightly unkind dead end for an honest stranger, which is what the
 * "not a Xaverian?" door beneath the form is for: it is on screen from the
 * start, before anyone has typed anything, so nobody has to fail to find out
 * they are in the wrong place.
 *
 * ## Two steps, one page
 *
 * The form does not navigate between steps. Someone who has just typed their
 * address and is now reading six digits off a phone must not be able to lose
 * the page by pressing back, and the address has to stay on screen so they know
 * which mailbox to look in.
 *
 * Turnstile guards the first step only, and is rendered only when a site key is
 * configured so the page works in development before anyone has a Cloudflare
 * account.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';

type Step = 'email' | 'code';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

export function LoginForm({ siteKey, initialNotice }: { siteKey: string | null; initialNotice?: string }) {
  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(initialNotice ?? '');
  const [problem, setProblem] = useState(Boolean(initialNotice));
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

  async function post(url: string, body: FormData) {
    try {
      const response = await fetch(url, { method: 'POST', body });
      const data = (await response.json()) as { message?: string; next?: string };
      return { ok: response.ok, message: data.message ?? '', next: data.next };
    } catch {
      return {
        ok: false,
        message: 'We could not reach the server. Please check your connection and try again.',
        next: undefined,
      };
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const typed = String(data.get('email') ?? '');
    setBusy(true);

    const result = await post('/api/auth/request', data);

    setBusy(false);
    setProblem(!result.ok);
    if (result.ok) {
      setEmail(typed);
      setStep('code');
      // Not the server's sentence. It says "if that address is registered, a
      // code is on its way", and the panel at the top of the code step says the
      // same thing with the address filled in — printing both puts the message
      // on screen twice, the second time less usefully. The notice slot is kept
      // clear for what goes wrong next.
      setNotice('');
    } else {
      setNotice(result.message);
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

    const result = await post('/api/auth/verify', data);

    if (result.ok) {
      // A full navigation rather than a router push. The session cookie was set
      // on this response, and the pages that vary by it are server-rendered —
      // a client-side transition could paint a cached signed-out copy first.
      window.location.assign(result.next ?? '/alumni');
      return;
    }

    setBusy(false);
    setNotice(result.message);
    setProblem(true);
  }

  /**
   * Back to the address step, with what was typed still in the box.
   *
   * This is also how another code is sent, and deliberately so: the request
   * endpoint requires a Turnstile token, each token is single-use, and the
   * widget lives on the first step. A "resend" button down here would post
   * without one and fail in production for a reason the visitor can neither see
   * nor act on — the widget is not even on screen. Returning to a step that has
   * a fresh challenge and a pre-filled address costs one button press and
   * always works.
   */
  function startOver() {
    setStep('email');
    setNotice('');
    setProblem(false);
  }

  return (
    <>
      {step === 'email' ? (
        <form onSubmit={submitEmail} noValidate>
          <label className="auth-field" htmlFor="email">
            Your email address
          </label>
          <input
            className="auth-input"
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="you@gmail.com"
            defaultValue={email}
            disabled={busy}
          />

          {siteKey && <div className="auth-turnstile" ref={widget} />}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate>
          <p className="auth-sent">
            If <strong>{email}</strong> is registered with the Association, a six-digit code is on its way.
            It expires in ten minutes.
          </p>

          <label className="auth-field" htmlFor="code">
            Six-digit code
          </label>
          <input
            className="auth-input auth-input--code"
            id="code"
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

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>

          <div className="auth-secondary">
            <button type="button" className="auth-link" disabled={busy} onClick={startOver}>
              Send another code, or use a different address
            </button>
          </div>
        </form>
      )}

      {notice && (
        <p className={`auth-notice${problem ? ' auth-notice--problem' : ''}`} role="status" aria-live="polite">
          {notice}
        </p>
      )}
    </>
  );
}
