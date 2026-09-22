'use client';

/**
 * The three pieces of behaviour the Nostalgia run shares.
 *
 * The first two are deliberately inert before mount. The countdown renders
 * nothing on the server, because the server and the reader can disagree about
 * what second it is and a hydration mismatch on the first screen is the one
 * place it shows. The tilt does nothing until a real pointer moves over the
 * card, so a touch device and a reduced-motion reader get a flat, still poster.
 *
 * The third is the opposite kind of thing: it exists to make the page stop
 * doing work nobody asked for.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Indian Standard Time, in minutes, so "10:00 AM on 3 October" means the same
 * thing to a reader in Mumbai and a reader abroad. The event is at the Taj
 * Santacruz; the poster's clock is local to it.
 */
const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Time remaining until `iso` at `hour`:`minute` IST, recomputed every second.
 * `null` before mount and once the moment has passed — the page says nothing
 * rather than counting up.
 */
export function useCountdown(iso: string, hour = 10, minute = 0): TimeLeft | null {
  const [left, setLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    const [y, m, d] = iso.split('-').map(Number);
    const target = Date.UTC(y, m - 1, d, hour, minute) - IST_OFFSET_MINUTES * 60_000;

    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) {
        setLeft(null);
        return false;
      }
      const total = Math.floor(ms / 1000);
      setLeft({
        days: Math.floor(total / 86_400),
        hours: Math.floor(total / 3_600) % 24,
        minutes: Math.floor(total / 60) % 60,
        seconds: total % 60,
      });
      return true;
    };

    if (!tick()) return;
    const timer = window.setInterval(() => {
      if (!tick()) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [iso, hour, minute]);

  return left;
}

/**
 * Pointer-parallax for the poster card.
 *
 * The handler writes two custom properties and nothing else — `--tilt-x` and
 * `--tilt-y` in degrees, plus `--gloss-x/y` as percentages for the sheen — and
 * the stylesheet decides what to do with them. That keeps the rotation, the
 * shadow and the highlight in one place in CSS, and keeps this to a single
 * style write per frame with no React state in the loop.
 */
/**
 * Marks a section `data-idle` once it is well clear of the viewport, so the
 * stylesheet can stop whatever is looping inside it.
 *
 * The hero holds twenty-two infinite animations — eighteen motes, the bloom,
 * the poster's breathe and its foil, and the gilt sweep on the title — and all
 * of them were still running with the hero five thousand pixels above the
 * screen. The gilt one is not cheap: a moving `background-position` on a
 * `background-clip: text` element repaints the glyphs every frame instead of
 * being handed to the compositor, and it was doing that on a 118px display
 * line, forever. Frames spent there are frames not spent on the scroll.
 *
 * The margin is generous on purpose. A section resumes 300px before it comes
 * back into view, so nothing is ever caught standing still, and the animations
 * are *paused* rather than removed — they carry on from where they stopped
 * instead of snapping back to the start of their cycle.
 *
 * The default is "running": `data-idle` is only ever added by the observer, so
 * if it never runs the page behaves exactly as it does today.
 */
export function useIdleWhenOffscreen<T extends HTMLElement>(margin = '300px') {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) delete element.dataset.idle;
        else element.dataset.idle = 'true';
      },
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [margin]);

  return ref;
}

export function useTilt<T extends HTMLElement>(maxDegrees = 7) {
  const ref = useRef<T>(null);
  const frame = useRef(0);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<T>) => {
      const element = ref.current;
      if (!element || event.pointerType === 'touch' || prefersReducedMotion()) return;
      const { clientX, clientY } = event;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const box = element.getBoundingClientRect();
        const x = (clientX - box.left) / box.width;
        const y = (clientY - box.top) / box.height;
        element.style.setProperty('--tilt-y', `${(x - 0.5) * 2 * maxDegrees}deg`);
        element.style.setProperty('--tilt-x', `${(0.5 - y) * 2 * maxDegrees}deg`);
        element.style.setProperty('--gloss-x', `${x * 100}%`);
        element.style.setProperty('--gloss-y', `${y * 100}%`);
        element.dataset.tilting = 'true';
      });
    },
    [maxDegrees],
  );

  const onPointerLeave = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    cancelAnimationFrame(frame.current);
    element.style.setProperty('--tilt-x', '0deg');
    element.style.setProperty('--tilt-y', '0deg');
    delete element.dataset.tilting;
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { ref, onPointerMove, onPointerLeave };
}
