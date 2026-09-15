'use client';

/**
 * Every photograph the Association has supplied, set as justified rows.
 *
 * The six files are all landscape and all close to 3:2, but they range from
 * 1121px across to 278px — so the thing to align them on is height, not width.
 * Each row is a flex line where a picture's `flex-grow` is its own aspect
 * ratio and its basis is zero. That makes each width proportional to its
 * aspect, and since height is width ÷ aspect, every picture in a row comes out
 * at exactly the same height while the row fills the measure edge to edge. No
 * hand-set spans, no offsets, and it stays true at any width.
 *
 * The two rows are chosen so nothing has to be blown up to fit. Two large
 * pictures at 436px tall, then the four smaller ones as a strip at 197px:
 * the biggest file is drawn at 0.59× its own size, and the two that are drawn
 * over 1.0 are at 1.03× and 1.08×, which is nothing. Putting the 278px file in
 * a row of four is what keeps it honest — in a row of two it would have had to
 * stretch 2.3×.
 *
 * Rows drift at their own rate on scroll, tied to scroll position rather than
 * to a clock. It is the row that moves, never the pictures within it, because
 * the alignment is the point.
 */

import { useRef, useState } from 'react';
import { crossing, useScrollLink } from '@/lib/useScrollLink';
import { gallery } from '@/data/pages/events';
import { Lightbox } from './Lightbox';

/** The composition: which pictures share a row, and in what order. */
const ROWS = [
  [
    '/images/events/ripples-of-hope.png',
    '/images/events/womens-day.png',
    /* the one upright picture in the set: it sizes itself narrow beside the two
       landscape frames, which is what gives the row its rhythm */
    '/images/events/international-yoga-day.jpg',
  ],
  [
    '/images/events/ripples-of-hope-2.png',
    '/images/events/udaan.png',
    '/images/events/udaan-2.png',
    '/images/events/womens-day-2.png',
  ],
];

/** Parallax per row, in px across the section's pass. The row moves as one. */
const DRIFT = [-30, 22];

const rows = ROWS.map((srcs) =>
  srcs.map((src) => {
    const entry = gallery.find((g) => g.image.src === src);
    if (!entry) throw new Error(`gallery: no photograph for ${src}`);
    return { ...entry, index: gallery.indexOf(entry) };
  }),
);

export function EventsGallery() {
  const section = useRef<HTMLElement>(null);
  const rowEls = useRef<(HTMLLIElement | null)[]>([]);
  const buttons = useRef<Record<number, HTMLButtonElement | null>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  useScrollLink(
    section,
    (p) => {
      const shift = (p - 0.5) * 2; // −1 → 1 across the section's pass
      rowEls.current.forEach((row, i) => {
        if (row) row.style.transform = `translate3d(0, ${shift * (DRIFT[i] ?? 0)}px, 0)`;
      });
    },
    crossing(1, -0.2),
    [],
    null,
  );

  const openAt = (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    const img = event.currentTarget.querySelector('img');
    setOrigin(img ? img.getBoundingClientRect() : null);
    setOpen(index);
  };

  const close = () => {
    const button = open !== null ? buttons.current[open] : null;
    setOpen(null);
    setOrigin(null);
    button?.focus();
  };

  return (
    <section className="ev-gallery" id="gallery" ref={section} aria-labelledby="gallery-heading">
      <div className="ev-shell">
        <div className="ev-gallery__head">
          <h2 className="ev-section-title" id="gallery-heading">Gallery</h2>
        </div>

        <ul className="ev-gallery__rows">
          {rows.map((row, r) => (
            <li className="ev-gallery__row" key={r} data-count={row.length} ref={(el) => { rowEls.current[r] = el; }}>
              <ul>
                {row.map((entry) => (
                  <li
                    className="ev-gallery__cell"
                    key={entry.image.src}
                    /* grow by the aspect ratio, so the widths come out in
                       proportion and every height in the row matches */
                    style={{
                      '--ar': `${entry.image.width} / ${entry.image.height}`,
                      '--grow': entry.image.width / entry.image.height,
                    } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      className="ev-gallery__button"
                      onClick={(e) => openAt(entry.index, e)}
                      ref={(el) => { buttons.current[entry.index] = el; }}
                    >
                      <span className="ev-gallery__frame">
                        <img
                          src={entry.image.src}
                          width={entry.image.width}
                          height={entry.image.height}
                          alt={entry.image.alt}
                          loading="lazy"
                          decoding="async"
                          sizes="(max-width: 809.98px) calc(100vw - 40px), (max-width: 1199.98px) 46vw, 640px"
                        />
                        <span className="ev-gallery__zoom" aria-hidden="true">View</span>
                      </span>
                      <span className="ev-gallery__caption">
                        <span className="ev-gallery__title">{entry.title}</span>
                        <span className="ev-gallery__date">{entry.date}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      {open !== null ? (
        <Lightbox
          items={gallery.map((g) => ({ image: g.image, title: g.title, date: g.date, place: g.place }))}
          index={open}
          origin={origin}
          onClose={close}
          onStep={(next) => { setOrigin(null); setOpen(next); }}
        />
      ) : null}
    </section>
  );
}
