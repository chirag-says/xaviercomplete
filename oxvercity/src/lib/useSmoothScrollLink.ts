'use client';

/**
 * `useScrollLink`, with the reading eased instead of taken raw.
 *
 * The plain link writes the scroll position straight to the element, which is
 * exact but slightly mechanical: stop the wheel and the motion stops in the
 * same frame. This one keeps a second value that chases the real one at a
 * fixed rate per frame, so a movement arrives a few frames late and settles
 * rather than halting. That lag is the whole of the "smooth scroll" feel, and
 * it costs nothing that native scrolling pays for — the page still scrolls the
 * way the browser and the operating system say it should, the scrollbar is
 * still the scrollbar, and a keyboard, a screen reader or a trackpad gesture
 * behaves exactly as it did. Nothing here intercepts a wheel or a touch.
 *
 * The rAF loop only runs while the two values disagree, so a still page costs
 * no frames at all.
 *
 * Reduced motion calls `apply` once with `reducedProgress` and never listens,
 * the same contract as `useScrollLink`.
 */

import { useEffect, type RefObject } from 'react';
import type { ScrollRange } from './useScrollLink';

/** Fraction of the remaining distance closed each frame at 60fps. */
const FOLLOW = 0.12;
/** Below this the two are treated as equal and the loop stops. */
const SETTLED = 0.0004;

export function useSmoothScrollLink(
  ref: RefObject<HTMLElement | null>,
  apply: (progress: number) => void,
  range: (element: HTMLElement) => ScrollRange,
  deps: unknown[] = [],
  reducedProgress: number | null = 1,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (reducedProgress !== null) apply(reducedProgress);
      return;
    }

    let start = 0;
    let length = 1;
    const measure = () => {
      const next = range(element);
      start = next.start;
      length = Math.max(next.length, 1);
    };

    const read = () => Math.min(Math.max((window.scrollY - start) / length, 0), 1);

    let target = 0;
    let current = 0;
    let frame = 0;
    let last = 0;

    const tick = (time: number) => {
      // scale the follow rate by the real frame time, so a 120Hz display and a
      // 60Hz one settle over the same number of milliseconds
      const step = last ? Math.min((time - last) / 16.667, 4) : 1;
      last = time;
      const gap = target - current;
      if (Math.abs(gap) < SETTLED) {
        current = target;
        apply(current);
        frame = 0;
        last = 0;
        return;
      }
      current += gap * Math.min(FOLLOW * step, 1);
      apply(current);
      frame = requestAnimationFrame(tick);
    };

    const wake = () => {
      target = read();
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onResize = () => {
      measure();
      wake();
    };

    measure();
    target = read();
    current = target;
    apply(current);

    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(onResize);
    observer.observe(element);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
