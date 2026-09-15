'use client';

/**
 * The site's general enquiry form — the contact page and the "Get in touch"
 * band that appears on the alumni, profile and events pages.
 *
 * ## What changed, and why it mattered
 *
 * `action` used to be optional, and a form without one reported success: it set
 * the sent state, cleared the fields and discarded everything. Framer posted
 * these to its own form service, which a self-hosted rebuild does not have, so
 * every form on the site had been quietly doing that. A visitor filled it in,
 * read "Message sent", and nobody ever saw the message — worse than having no
 * form at all, because it costs the sender the chance to email instead.
 *
 * `action` is now **required**. The branch that lied no longer exists and
 * cannot be reintroduced without the compiler objecting at both call sites.
 *
 * ## The notice is not decoration
 *
 * The server's own words are rendered, success or failure. A form that fails
 * has to say what to do instead — here, email the Association directly — and
 * the only component that can tell "we could not reach the server" from "we
 * could not send it" is the one holding the response.
 *
 * `SubmitButton` renders Framer's submit pill (`framer-LUWvx`) and reads the
 * form state from context to swap its label while sending and after.
 */

import { createContext, useContext, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { tokens } from '@/lib/tokens';

export type FormState = 'idle' | 'sending' | 'sent' | 'error';

const FormStateContext = createContext<FormState>('idle');

export interface FormLabels {
  submit: string;
  sending: string;
  sent: string;
  error: string;
}

export function SiteForm({
  className,
  action,
  source,
  children,
}: {
  className: string;
  /** Required. See the note above — an actionless form used to report success. */
  action: string;
  /** Which page this instance sits on, so a reply has some context. */
  source?: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<FormState>('idle');
  const [notice, setNotice] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set('source', source ?? window.location.pathname);

    setState('sending');
    setNotice('');

    try {
      const response = await fetch(action, { method: 'POST', body });
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

  return (
    <FormStateContext.Provider value={state}>
      {/*
        Browser validation is left on. `required` is meaningful on all four
        fields now — including the consent box, which the server checks too —
        and an immediate "please tick this" beats a round trip.
      */}
      <form className={className} data-state={state} onSubmit={onSubmit}>
        {children}
        {notice && (
          <p
            className={`site-form-notice${state === 'error' ? ' site-form-notice--problem' : ''}`}
            role="status"
            aria-live="polite"
          >
            {notice}
          </p>
        )}
      </form>
    </FormStateContext.Provider>
  );
}

const BUTTON_VARIANT = {
  default: { cls: 'framer-v-hq3rky', name: 'Default', padding: '17px 32px 17px 32px', focusable: true },
  phone: { cls: 'framer-v-1xh1r0', name: 'Phone', padding: '12.5px 24px 12.5px 24px', focusable: false },
} as const;

const TEXT = { '--extracted-r6o4lv': tokens.white, '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties;
const P = { '--framer-text-color': `var(--extracted-r6o4lv, ${tokens.white})` } as CSSProperties;

export function SubmitButton({ labels, variant, containerClass }: { labels: FormLabels; variant: keyof typeof BUTTON_VARIANT; containerClass: string }) {
  const state = useContext(FormStateContext);
  const v = BUTTON_VARIANT[variant];
  const label = state === 'idle' ? labels.submit : labels[state];
  return (
    <div className={containerClass}>
      <button
        type="submit"
        className={`framer-LUWvx framer-yylGA framer-hq3rky ${v.cls}`}
        data-framer-name={v.name}
        data-reset="button"
        tabIndex={v.focusable ? 0 : undefined}
        disabled={state === 'sending'}
        style={{ '--575tb': v.padding, backgroundColor: tokens.ink, width: '100%', borderBottomLeftRadius: '50px', borderBottomRightRadius: '50px', borderTopLeftRadius: '50px', borderTopRightRadius: '50px', opacity: 1 } as CSSProperties}
      >
        <div className="framer-1k8ult7" data-framer-name="Text Wrapper" style={{ opacity: 1 }}>
          <div className="framer-mzvlr6" data-framer-name="Default Text" data-framer-component-type="RichTextContainer" style={TEXT}>
            <p className="framer-text framer-styles-preset-c29y5p" data-styles-preset="MIzrA6q79" style={P}>
              {label}
            </p>
          </div>
          <div className="framer-rkzbrv" data-framer-name="Hover Text" data-framer-component-type="RichTextContainer" style={TEXT}>
            <p className="framer-text framer-styles-preset-c29y5p" data-styles-preset="MIzrA6q79" style={P}>
              {label}
            </p>
          </div>
        </div>
        <div className="framer-1lp5hs3" data-framer-name="Arrow Wrap" style={{ opacity: 1 }}>
          <div data-framer-name="Defualt Icon" className="framer-utBpC framer-w7iu64" style={{ '--imrg1o': tokens.white } as CSSProperties} />
          <div data-framer-name="Hover Icon" className="framer-utBpC framer-824uir" style={{ '--imrg1o': tokens.white, transform: 'translate(-50%, -50%)' } as CSSProperties} />
        </div>
      </button>
    </div>
  );
}
