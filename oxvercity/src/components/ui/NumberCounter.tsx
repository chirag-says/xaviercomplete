'use client';

/**
 * Framer's "Number Counter" code component as the site configures it: the
 * number starts ten below its final value and counts up over 1.5s with an
 * ease-in-out curve once it scrolls into view, then stays. Reduced motion
 * shows the final value at once.
 *
 * Three additions the Association's facts need: `display` renders a fact that
 * is not a number ("A++") in the same slot without a count; `group` adds
 * thousands separators, which a count wants (8,600) and a year does not
 * (1860); and the run-up never starts below zero, so a small number does not
 * count up from a negative.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { animate } from 'motion';
import { useInView } from '@/lib/useInView';
import { prefersReducedMotion } from '@/lib/motion';

export const COUNTER_RUN_UP = 10;
const DURATION = 1.5;
const EASE: [number, number, number, number] = [0.44, 0, 0.56, 1];

export function NumberCounter({ end, suffix, display, group, style }: { end: number; suffix: string; display?: string; group?: boolean; style: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const start = Math.max(0, end - COUNTER_RUN_UP);
  const [value, setValue] = useState(start);

  useEffect(() => {
    if (!inView || display) return;
    if (prefersReducedMotion()) {
      setValue(end);
      return;
    }
    const controls = animate(start, end, { duration: DURATION, ease: EASE, onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [inView, start, end, display]);

  return (
    <span
      ref={ref}
      style={{ display: 'inline-block', width: 'max-content', height: 'max-content', textAlign: 'center', ...style, cursor: 'default', userSelect: 'none' }}
      aria-live="polite"
      tabIndex={0}
    >
      {display ?? (group ? value.toLocaleString('en-IN') : value)}
      {display ? '' : suffix}
    </span>
  );
}
