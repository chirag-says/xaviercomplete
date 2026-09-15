'use client';

/**
 * What the 2023 meet actually held: the bill, the four panels, and the names
 * printed on the poster. All of it was already in the data file; what changes
 * here is that it is set as an index rather than as prose.
 *
 * The four panels are rows, not cards. Each is numbered, the title is set at a
 * size you can read across a room, and the subject sits beside it — the shape
 * of a running order or a contents page, which is what this is. The detail is
 * always rendered, so the row is complete before any pointer arrives and a
 * touch or a screen reader is never short of anything; hover and focus only
 * raise it. An ink wipe runs the width of the row behind the type on the same
 * gesture, which is the site's own hover language enlarged.
 *
 * The names run underneath as one slow band of outlined type. It is a picture
 * of a guest list rather than a paragraph of one: the real list is rendered
 * once and read normally, and the second copy exists only to make the loop
 * seamless, so it is hidden from assistive technology. It stops on hover, on
 * focus anywhere inside it, and entirely under reduced motion.
 */

import { useEffect, useRef } from 'react';
import { animate } from 'motion';
import { prefersReducedMotion } from '@/lib/motion';
import { useInView } from '@/lib/useInView';
import { billSection, westZone } from '@/data/pages/chapters';

const RISE = { type: 'tween' as const, duration: 0.85, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

export function ChapterBill() {
  const section = useRef<HTMLElement>(null);
  const inView = useInView(section, { threshold: 0.08 });
  const played = useRef(false);
  const { meet } = westZone;

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const chips = Array.from(root.querySelectorAll<HTMLElement>('[data-chip]'));
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-row]'));

    if (prefersReducedMotion()) {
      for (const el of [...chips, ...rows]) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      }
      return;
    }
    if (!inView || played.current) return;
    played.current = true;

    const running = [
      ...chips.map((chip, i) => animate(chip, { opacity: [0, 1], y: [18, 0] }, { ...RISE, duration: 0.6, delay: i * 0.06 })),
      ...rows.map((row, i) => animate(row, { opacity: [0, 1], y: [18, 0] }, { ...RISE, delay: 0.14 + i * 0.08 })),
    ];
    return () => {
      for (const control of running) control.stop();
    };
  }, [inView]);

  return (
    <section className="cx-billwrap" id="bill" aria-labelledby="bill-heading" ref={section}>
      <div className="ev-shell">
        <div className="cx-billwrap__head">
          <div className="cx-billwrap__intro">
            <p className="cx-eyebrow">{billSection.eyebrow}</p>
            <h2 className="ev-section-title cx-billwrap__title" id="bill-heading">
              {billSection.title}
            </h2>
          </div>
          <p className="cx-billwrap__note">{meet.note}</p>
        </div>

        <ul className="cx-chips" aria-label="What the day held">
          {meet.bill.map((line) => (
            <li className="cx-chips__item" key={line} data-chip="">
              {line}
            </li>
          ))}
        </ul>

        <ol className="cx-index">
          {meet.panels.map((panel, i) => (
            <li className="cx-index__row" key={panel.title} data-row="">
              <span className="cx-index__wipe" aria-hidden="true" />
              <span className="cx-index__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="cx-index__title">{panel.title}</span>
              <span className="cx-index__detail">{panel.detail}</span>
              {/* a mark, not an arrow: the row is a listing, it goes nowhere */}
              <span className="cx-index__mark" aria-hidden="true" />
            </li>
          ))}
        </ol>
      </div>

      <div className="cx-band">
        <p className="cx-band__label">On the bill</p>
        <div className="cx-band__track">
          <ul className="cx-band__run">
            {meet.names.map((name) => (
              <li key={name}>
                {name}
                <span className="cx-band__sep" aria-hidden="true">
                  ✦
                </span>
              </li>
            ))}
          </ul>
          {/* the copy that makes the loop seamless; it says nothing new */}
          <ul className="cx-band__run" aria-hidden="true">
            {meet.names.map((name) => (
              <li key={name}>
                {name}
                <span className="cx-band__sep">✦</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
