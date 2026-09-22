'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * True once the element has entered the viewport (and stays true when `once`).
 *
 * `rootMargin` moves the line the element has to cross. A negative bottom
 * value — `'0px 0px -14% 0px'` — pulls the line up off the bottom edge of the
 * screen, which is what a scroll reveal wants: fired at the edge, the motion
 * is over before the element is anywhere the reader is looking.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { once = true, threshold = 0, rootMargin = '0px' }: { once?: boolean; threshold?: number; rootMargin?: string } = {},
): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, once, threshold, rootMargin]);
  return inView;
}
