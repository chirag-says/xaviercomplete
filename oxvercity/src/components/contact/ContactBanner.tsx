'use client';

/**
 * Contact page hero — two-column layout:
 *   Left:  heading, description
 *   Right: the contact form card
 */

import { useState, type FormEvent } from 'react';
import { contactPage } from '@/data/pages/contact';

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

type FormState = 'idle' | 'sending' | 'sent' | 'error';

export function ContactBanner() {
  const [state, setState] = useState<FormState>('idle');
  const [notice, setNotice] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set('source', '/contact');

    setState('sending');
    setNotice('');

    try {
      const response = await fetch(contactPage.form.action, { method: 'POST', body });
      const data = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setState('error');
        setNotice(data.message ?? 'We could not send that. Please email the Association directly.');
        return;
      }

      setState('sent');
      setNotice(data.message ?? 'Thank you — your message is with the Association.');
      form.reset();
    } catch {
      setState('error');
      setNotice('We could not reach the server. Check your connection, or email the Association directly.');
    }
  }

  const label = state === 'idle' ? contactPage.form.submit
    : state === 'sending' ? contactPage.form.sending
    : state === 'sent' ? contactPage.form.sent
    : contactPage.form.error;

  return (
    <section className="ct-hero">
      <div className="ct-hero__inner">
        {/* ── Left column ── */}
        <div className="ct-hero__left">
          <p className="ct-hero__eyebrow">Contact Us</p>
          <h1 className="ct-hero__title">
            Let&rsquo;s start a<br />
            <em>conversation</em>
          </h1>
          <p className="ct-hero__desc">{contactPage.intro}</p>
        </div>

        {/* ── Right column — contact form ── */}
        <div className="ct-hero__right">
          <div className="ct-form__card">
            <form onSubmit={onSubmit}>
              <div className="ct-form__row">
                <div className="ct-form__field">
                  <label className="ct-form__label" htmlFor="ct-name">{contactPage.form.nameLabel}</label>
                  <input className="ct-form__input" id="ct-name" type="text" name="Name" placeholder={contactPage.form.namePlaceholder} required />
                </div>
                <div className="ct-form__field">
                  <label className="ct-form__label" htmlFor="ct-email">{contactPage.form.emailLabel}</label>
                  <input className="ct-form__input" id="ct-email" type="email" name="Email" placeholder={contactPage.form.emailPlaceholder} required />
                </div>
              </div>

              <div className="ct-form__field">
                <label className="ct-form__label" htmlFor="ct-message">{contactPage.form.messageLabel}</label>
                <textarea className="ct-form__textarea" id="ct-message" name="Message" placeholder={contactPage.form.messagePlaceholder} rows={4} />
              </div>

              <label className="ct-form__consent">
                <input className="ct-form__checkbox" type="checkbox" name="Consent" required />
                <span className="ct-form__consent-text">{contactPage.form.consent}</span>
              </label>

              <button className="ct-form__submit" type="submit" disabled={state === 'sending'}>
                {label}
                <ArrowIcon />
              </button>

              {/* Honeypots */}
              <input type="text" name="website" tabIndex={-1} autoComplete="one-time-code" aria-hidden="true" style={{ position: 'absolute', transform: 'scale(0)' }} />
              <input type="text" name="company" tabIndex={-1} autoComplete="one-time-code" aria-hidden="true" style={{ position: 'absolute', transform: 'scale(0)' }} />

              {notice && (
                <p className={`ct-form__notice${state === 'error' ? ' ct-form__notice--error' : ''}`} role="status" aria-live="polite">
                  {notice}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>

      <div aria-label="Scroll Trigger" className="framer-c3vasr" data-framer-name="Scroll Triger" id="scroll-trigger" />
    </section>
  );
}
