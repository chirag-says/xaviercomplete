'use client';

import { useEffect, useState, type RefObject } from 'react';

/** True once the element has entered the viewport (and stays true when `once`). */
export function useInView(ref: RefObject<Element | null>, { once = true, threshold = 0 }: { once?: boolean; threshold?: number } = {}): boolean {
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
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, once, threshold]);
  return inView;
}
