'use client';

/**
 * Attending: the rates and the payment code, both exactly as the Association
 * issued them.
 *
 * Neither is re-typed. The pricing table and the QR are the artwork SXCCAA
 * published, and they stay artwork — the prices are not restated as markup and
 * the UPI id behind the code is not set as text, for the same reason the rest
 * of this page leaves the donor-pass numbers in the poster. The alternative
 * text carries the rates in full, so the information is available to a screen
 * reader without the handle becoming machine-readable copy on a public page.
 *
 * The plate is ink, which is the only place after the opening that the page
 * goes dark: it is the one section asking the reader to do something, and the
 * tonal jump is what marks it out. Both cards sit on white — a QR on a tinted
 * ground is a QR that sometimes will not scan.
 */

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { animate } from 'motion';
import { prefersReducedMotion } from '@/lib/motion';
import { useInView } from '@/lib/useInView';
import { joinSection } from '@/data/pages/chapters';

const RISE = { type: 'tween' as const, duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

export function ChapterJoin() {
  const section = useRef<HTMLElement>(null);
  const inView = useInView(section, { threshold: 0.1 });
  const played = useRef(false);

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-card]'));

    if (prefersReducedMotion()) {
      for (const el of cards) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
      return;
    }
    if (!inView || played.current) return;
    played.current = true;

    const running = cards.map((card, i) => animate(card, { opacity: [0, 1], y: [24, 0] }, { ...RISE, delay: i * 0.12 }));
    return () => {
      for (const control of running) control.stop();
    };
  }, [inView]);

  return (
    <section className="cx-join" aria-labelledby="join-heading" ref={section}>
      <div className="ev-shell">
        <div className="cx-join__plate">
          <div className="cx-join__words">
            <p className="cx-eyebrow cx-eyebrow--dark">{joinSection.eyebrow}</p>
            <h2 className="cx-join__title" id="join-heading">
              {joinSection.title}
            </h2>
            <p className="cx-join__note">{joinSection.note}</p>
          </div>

          <div className="cx-join__cards">
            <figure className="cx-join__card" data-card="">
              <figcaption className="cx-join__label">Session pricing</figcaption>
              <Image
                src="/images/chapter-pricing.png"
                alt="Session pricing table — Full Day: Xaverian ₹5000, Spouse ₹3000; Day Session: Xaverian ₹2500, Spouse ₹2000; Awards & Dinner: Xaverian ₹3500, Spouse ₹2000; Non Xaverian ₹7500"
                width={470}
                height={220}
                className="cx-join__img"
                sizes="(max-width: 809.98px) calc(100vw - 96px), 420px"
              />
            </figure>

            <figure className="cx-join__card cx-join__card--qr" data-card="">
              <figcaption className="cx-join__label">Scan to pay</figcaption>
              <Image
                src="/images/chapter-qr.png"
                alt="SXC Cal Alumni Association — UPI QR code for payment"
                width={340}
                height={360}
                className="cx-join__img cx-join__img--qr"
                sizes="(max-width: 809.98px) 220px, 240px"
              />
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
