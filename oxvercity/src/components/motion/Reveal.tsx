'use client';

/**
 * The site's scroll reveal, for markup the Framer export does not cover.
 *
 * `FramerEffects` replays the recorded specs by class name, and those classes
 * carry layout of their own, so hand-written sections cannot borrow them. This
 * reproduces the same motion instead: fade up from 40px on Framer's default
 * spring (stiffness 400, damping 100), once, when the element crosses the
 * reveal line. Reduced motion renders the resting state and never animates.
 *
 * The line is not the bottom edge of the screen. Fired there, a 40–60px rise
 * on a 400/100 spring — which settles in about half a second — is finished
 * before the element has climbed far enough for anyone to have looked at it,
 * so the page reads as blocks that are simply already there. Pulling the line
 * up a seventh of the viewport means the reveal happens where the reader's eye
 * actually is. It applies wherever `Reveal` is used, which is this site's only
 * hand-written scroll reveal.
 */

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { animate } from 'motion';
import { useInView } from '@/lib/useInView';
import { prefersReducedMotion } from '@/lib/motion';

const SPRING = { type: 'spring', stiffness: 400, damping: 100, mass: 1 } as const;

/** The reveal line: a seventh of the viewport up from its bottom edge. */
const REVEAL_LINE = '0px 0px -14% 0px';

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
  const inView = useInView(ref, { rootMargin: REVEAL_LINE });

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
