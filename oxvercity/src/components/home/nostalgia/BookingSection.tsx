'use client';

/**
 * What it costs, and where to send it.
 *
 * The booking ladder and the bank block are printed on opposite corners of the
 * invitation poster, which is fine on a sheet you take in at a glance and bad
 * on a phone. Here they are one section, in the order the reader needs them:
 * pick the step you fall in, then transfer to the account below it.
 *
 * Two judgements are worth naming.
 *
 * The "current step" marker is arithmetic on the cut-off dates the poster
 * prints, computed after mount so the server's clock and the reader's cannot
 * disagree. Each step is capped by a booking count *or* a date and only the
 * Association knows the count, so a passed date marks a step "closed" while the
 * live one says "on now" — neither claims a tier is sold out, and the ladder is
 * still readable in full if the script never runs.
 *
 * The account number and IFSC are set as text, with a copy button, rather than
 * left inside the artwork. They are already published on a poster the
 * Association circulates; what this buys is that nobody transcribes an
 * eleven-digit account number off a JPEG on a phone screen.
 */

import { useEffect, useRef, useState } from 'react';
import { Reveal } from '@/components/motion/Reveal';
import { bank, passTiers, registration } from '@/data/pages/nostalgia';
import type { BankField as BankFieldData } from '@/data/pages/nostalgia';

type Standing = 'closed' | 'open' | 'later';

/** Which step of the ladder today falls in. `null` until mounted. */
function useStandings(): Record<string, Standing> | null {
  const [standings, setStandings] = useState<Record<string, Standing> | null>(null);
  useEffect(() => {
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    let found = false;
    const next: Record<string, Standing> = {};
    for (const tier of passTiers) {
      const [y, m, d] = tier.until.split('-').map(Number);
      const passed = Date.UTC(y, m - 1, d) < today;
      if (passed) next[tier.id] = 'closed';
      else if (!found) {
        next[tier.id] = 'open';
        found = true;
      } else next[tier.id] = 'later';
    }
    setStandings(next);
  }, []);
  return standings;
}

const STANDING_LABEL: Record<Standing, string> = { closed: 'Closed', open: 'On now', later: 'Opens after' };

/**
 * One field of the account, with a button that copies it.
 *
 * The clipboard is the one thing on this page that can refuse. `writeText`
 * rejects with `NotAllowedError` whenever the document does not have focus,
 * and browsers vary on what else counts — an iframe, a permissions policy, an
 * older Safari. A silent catch there is the worst outcome of all: the reader
 * clicks, nothing happens, and they have no way to tell whether the account
 * number is on their clipboard or not. On this field that is money.
 *
 * So there are three rungs, and a click always ends on one of them:
 *   1. the Clipboard API;
 *   2. the old `execCommand('copy')` off a throwaway textarea;
 *   3. selecting the value in the page and saying so, which leaves the reader
 *      one keystroke away rather than stranded.
 */
function BankField({ field }: { field: BankFieldData }) {
  const value = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => setState('idle'), state === 'copied' ? 1900 : 4000);
    return () => window.clearTimeout(timer);
  }, [state]);

  /** The pre-Clipboard-API route, still the only one some browsers allow. */
  const copyByCommand = (text: string) => {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.append(scratch);
    scratch.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    scratch.remove();
    return ok;
  };

  const copy = async () => {
    const text = field.copy ?? field.value;
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
      return;
    } catch {
      /* falls through to the two rungs below */
    }
    if (copyByCommand(text)) {
      setState('copied');
      return;
    }
    const node = value.current;
    if (node) window.getSelection()?.selectAllChildren(node);
    setState('manual');
  };

  const label =
    state === 'copied' ? 'Copied' : state === 'manual' ? 'Selected — press ⌘C' : `Copy ${field.label.toLowerCase()}`;

  return (
    <div className="nos-bank__row">
      <dt>{field.label}</dt>
      <dd>
        <span className="nos-bank__value" ref={value}>{field.value}</span>
        {field.copy ? (
          <button type="button" className="nos-copy" data-state={state} onClick={copy}>
            {/* the label changes under the reader, so it is announced */}
            <span className="nos-copy__label" aria-live="polite">{label}</span>
            <span className="nos-copy__icon" aria-hidden="true">{state === 'copied' ? '✓' : state === 'manual' ? '⌘' : '⧉'}</span>
          </button>
        ) : null}
      </dd>
    </div>
  );
}

export function BookingSection() {
  const standings = useStandings();

  return (
    <section className="nos-book" id="nos-passes" aria-labelledby="nos-book-heading">
      <div className="nos-book__wash" aria-hidden="true" />

      <div className="nos-shell nos-book__shell">
        <div className="nos-book__head">
          <Reveal as="p" className="nos-eyebrow nos-book__eyebrow" distance={24}>
            <span className="nos-rule" aria-hidden="true" />
            Early bird offers
          </Reveal>
          {/* `Reveal` sets the element's style and nothing else, so the anchor
              for aria-labelledby goes on a span inside it */}
          <Reveal as="h2" className="nos-title nos-book__title" delay={0.05}>
            <span id="nos-book-heading">Book your seat today</span>
          </Reveal>
          <Reveal as="p" className="nos-book__note" delay={0.1} distance={24}>
            {registration.note} — every rate below is {registration.tax.replace('+ ', 'plus ')}.
          </Reveal>
        </div>

        <ol className="nos-tiers">
          {passTiers.map((tier, i) => {
            const standing = standings?.[tier.id];
            return (
              <Reveal as="li" className="nos-tier" key={tier.id} delay={0.08 * i} distance={44}>
                <div className="nos-tier__inner" data-standing={standing}>
                  <div className="nos-tier__top">
                    <p className="nos-tier__name">{tier.name}</p>
                    {standing ? <p className="nos-tier__standing">{STANDING_LABEL[standing]}</p> : null}
                  </div>
                  <p className="nos-tier__qualifier">
                    {tier.qualifier.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </p>
                  <p className="nos-tier__amount">
                    {tier.amount}
                    <span className="nos-tier__tax">{tier.tax}</span>
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ol>

        <Reveal className="nos-bank" delay={0.12} distance={48}>
          <div className="nos-bank__head">
            <span className="nos-bank__mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5 12 4l9 6.5" />
                <path d="M5 10.5V19M9.5 10.5V19M14.5 10.5V19M19 10.5V19" />
                <path d="M3 19h18" />
              </svg>
            </span>
            <div>
              <h3 className="nos-bank__title">{bank.heading}</h3>
              <p className="nos-bank__sub">Transfer to the account printed on the poster.</p>
            </div>
          </div>

          <dl className="nos-bank__grid">
            {bank.fields.map((field) => (
              <BankField field={field} key={field.label} />
            ))}
          </dl>

          <p className="nos-bank__foot">{bank.note}</p>
        </Reveal>
      </div>
    </section>
  );
}
