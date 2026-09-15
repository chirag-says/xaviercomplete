'use client';

/**
 * The site's scroll reveal, for markup the Framer export does not cover.
 *
 * `FramerEffects` replays the recorded specs by class name, and those classes
 * carry layout of their own, so hand-written sections cannot borrow them. This
 * reproduces the same motion instead: fade up from 40px on Framer's default
 * spring (stiffness 400, damping 100), once, when the element first crosses the
 * viewport. Reduced motion renders the resting state and never animates.
 */

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { animate } from 'motion';
import { useInView } from '@/lib/useInView';
import { prefersReducedMotion } from '@/lib/motion';

const SPRING = { type: 'spring', stiffness: 400, damping: 100, mass: 1 } as const;

export function Reveal({
  children,
  as: Tag = 'div',
  className,
  delay = 0,
  distance = 60,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  distance?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref);

  useEffect(() => {
    const element = ref.current;
    if (!element || !inView) return;
    if (prefersReducedMotion()) {
      element.style.opacity = '1';
      element.style.transform = 'none';
      return;
    }
    const controls = animate(element, { opacity: 1, y: 0 }, { ...SPRING, delay });
    void controls.finished.then(() => {
      element.style.willChange = '';
    });
    return () => controls.stop();
  }, [inView, delay]);

  return (
    <Tag ref={ref} data-reveal="" className={className} style={{ opacity: 0, transform: `translateY(${distance}px)`, willChange: 'transform' }}>
      {children}
    </Tag>
  );
}
