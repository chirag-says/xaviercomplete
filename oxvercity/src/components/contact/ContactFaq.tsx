'use client';

/**
 * FAQ section — warm cream ground matching the rest of the page.
 * Clean accordion with hairline borders and rotating plus icons.
 */

import { useState } from 'react';
import { faq } from '@/data/pages/contact';

function PlusIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="7" y1="1" x2="7" y2="13" />
      <line x1="1" y1="7" x2="13" y2="7" />
    </svg>
  );
}

export function ContactFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="ct-faq">
      <div className="ct-faq__inner">
        <div className="ct-faq__head">
          <p className="ct-faq__eyebrow">Support</p>
          <h2 className="ct-faq__title">Frequently Asked Questions</h2>
        </div>

        <div>
          {faq.map((item, i) => (
            <div key={item.question} className="ct-faq__item" data-open={open === i}>
              <button
                className="ct-faq__question"
                type="button"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {item.question}
                <span className="ct-faq__icon"><PlusIcon /></span>
              </button>
              <div className="ct-faq__answer">
                <p>{item.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
