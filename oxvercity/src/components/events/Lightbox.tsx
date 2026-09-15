'use client';

/**
 * The gallery's viewer.
 *
 * It opens from the thumbnail rather than on top of it: the figure's box is
 * measured at the moment of the click, the full frame is drawn where it will
 * finish, and the difference between the two is played back as one transform
 * (a FLIP). Only `transform` and `opacity` move, so the whole thing is a
 * compositor job.
 *
 * Keyboard: ← → step, Escape closes, Tab is held inside the dialog, and focus
 * returns to the figure that opened it. The scroll position behind is frozen
 * without the layout shift that `overflow: hidden` alone causes.
 *
 * Reduced motion keeps the fade and drops the flight.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SiteImage } from '@/lib/images';

export interface LightboxItem {
  image: SiteImage;
  title: string;
  date: string;
  place: string;
}

export function Lightbox({
  items,
  index,
  origin,
  onClose,
  onStep,
}: {
  items: LightboxItem[];
  index: number;
  /** The thumbnail's viewport box when it was clicked, for the flight. */
  origin: DOMRect | null;
  onClose: () => void;
  onStep: (next: number) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [flown, setFlown] = useState(false);
  const item = items[index];

  // freeze the page behind without the jump that removing the scrollbar causes
  useEffect(() => {
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const held = { overflow: body.style.overflow, padding: body.style.paddingRight };
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = held.overflow;
      body.style.paddingRight = held.padding;
    };
  }, []);

  // play the thumbnail's box back into the frame's
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!origin || reduced) { setFlown(true); return; }
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) { setFlown(true); return; }
    const scaleX = origin.width / box.width;
    const scaleY = origin.height / box.height;
    el.style.transformOrigin = 'top left';
    el.style.transform = `translate(${origin.left - box.left}px, ${origin.top - box.top}px) scale(${scaleX}, ${scaleY})`;
    el.style.transition = 'none';
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'transform 0.62s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = 'none';
      setFlown(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [origin]);

  const step = useCallback(
    (delta: number) => onStep((index + delta + items.length) % items.length),
    [index, items.length, onStep],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      else if (event.key === 'Tab') {
        const focusable = dialog.current?.querySelectorAll<HTMLElement>('button');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);

  return (
    <div
      className="ev-lightbox"
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={items.length > 1 ? `${item.title} — image ${index + 1} of ${items.length}` : item.title}
      data-flown={flown ? 'yes' : 'no'}
    >
      <button type="button" className="ev-lightbox__scrim" onClick={onClose} aria-label="Close the viewer" />

      <div className="ev-lightbox__frame" ref={frame}>
        <img
          src={item.image.src}
          width={item.image.width}
          height={item.image.height}
          alt={item.image.alt}
          decoding="async"
        />
      </div>

      <div className="ev-lightbox__bar">
        <p className="ev-lightbox__caption">
          <span className="ev-lightbox__title">{item.title}</span>
          <span className="ev-lightbox__meta">
            {item.place}
            {item.place && item.date ? ' · ' : ''}
            {item.date}
          </span>
        </p>
        {items.length > 1 ? (
          <p className="ev-lightbox__count" aria-hidden="true">
            {String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </p>
        ) : null}
      </div>

      {/* stepping is meaningless with one item — it would wrap to itself */}
      <div className="ev-lightbox__nav">
        {items.length > 1 ? (
          <>
            <button type="button" onClick={() => step(-1)} aria-label="Previous image">←</button>
            <button type="button" onClick={() => step(1)} aria-label="Next image">→</button>
          </>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close the viewer">Close</button>
      </div>
    </div>
  );
}
