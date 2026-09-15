'use client';

/**
 * Ties an element's appearance to scroll position rather than to a clock.
 *
 * `apply` is called with a progress from 0 to 1 across a range the caller
 * measures off the element, on every scroll, coalesced into one animation
 * frame. There is no timer, no spring and no easing between the reading and
 * the write: stop scrolling and it stops where it is, scroll back and it runs
 * backwards. Anything `apply` writes should be a transform, an opacity or a
 * custom property, so no frame costs a layout.
 *
 * The range is re-measured on resize and whenever the element's own box
 * changes, because both move the scroll position the range starts at.
 *
 * Reduced motion calls `apply` once with `reducedProgress` and never listens.
 * Pass `null` where the resting state is better expressed in the stylesheet
 * than as a point on the timeline.
 */

import { useEffect, type RefObject } from 'react';

export interface ScrollRange {
  /** Document scroll position at which progress is 0. */
  start: number;
  /** Scroll distance over which progress goes 0 → 1. Clamped to at least 1. */
  length: number;
}

/**
 * A range that runs while the element crosses the viewport: progress is 0 when
 * its top reaches `from` of the way down the viewport, and 1 when its top
 * reaches `to`. Both are fractions of the viewport height.
 */
export function crossing(from: number, to: number) {
  return (element: HTMLElement): ScrollRange => {
    const top = element.getBoundingClientRect().top + window.scrollY;
    return { start: top - window.innerHeight * from, length: window.innerHeight * (from - to) };
  };
}

/**
 * A range that runs for as long as a sticky child stays pinned inside the
 * element: progress is 0 when the element's top meets the child's `top` offset
 * and 1 when the element has been scrolled past by its own overhang.
 */
export function pinned(pin: RefObject<HTMLElement | null>) {
  return (element: HTMLElement): ScrollRange => {
    const child = pin.current;
    if (!child) return { start: 0, length: 1 };
    const offset = parseFloat(getComputedStyle(child).top) || 0;
    return {
      start: element.getBoundingClientRect().top + window.scrollY - offset,
      length: element.offsetHeight - child.offsetHeight,
    };
  };
}

export function useScrollLink(
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

    let frame = 0;
    const update = () => {
      frame = 0;
      apply(Math.min(Math.max((window.scrollY - start) / length, 0), 1));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      update();
    };

    measure();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(onResize);
    observer.observe(element);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
