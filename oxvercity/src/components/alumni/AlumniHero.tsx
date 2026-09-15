'use client';

/**
 * Editorial text-only hero for the Alumni page.
 * Oversized typography, animated stat counters, a ghosted watermark for depth.
 *
 * The counters are fed from the server rather than computed here, and they
 * count what the directory actually holds. The previous "120k+ alumni" was a
 * claim about the college, not about this dataset; a number on a page under the
 * Association's name should be one the page can substantiate.
 */

import { useEffect, useRef, useState } from 'react';

import { useInView } from '@/lib/useInView';

export interface DirectoryStats {
  /** Records visible in the directory right now. */
  total: number;
  /** Distinct batch years present. */
  batches: number;
  /** Distinct streams of study present. */
  streams: number;
}

function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCount(Math.round(eased * end));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, end]);

  return <span ref={ref} className="al-hero__stat-number">{count}{suffix}</span>;
}

export function AlumniHero({ stats }: { stats: DirectoryStats }) {
  return (
    <section className="al-hero" id="alumni-hero">
      <div className="al-shell">
        <div className="al-hero__content">
          <p className="al-eyebrow">The Xaverian Network</p>
          <h1 className="al-hero__headline">
            <span>One Legacy.</span>
            <span>Thousands of</span>
            <span className="al-hero__accent">Journeys.</span>
          </h1>
          <p className="al-hero__desc">
            Reconnect with Xaverians across generations, disciplines, professions
            and locations — and find the people whose path you want to follow.
          </p>
          <div className="al-hero__stats">
            <div className="al-hero__stat">
              <Counter end={stats.total} />
              <span className="al-hero__stat-label">In the directory</span>
            </div>
            <div className="al-hero__stat">
              <Counter end={stats.batches} />
              <span className="al-hero__stat-label">Batches</span>
            </div>
            <div className="al-hero__stat">
              <Counter end={stats.streams} />
              <span className="al-hero__stat-label">Streams</span>
            </div>
            <div className="al-hero__stat">
              <Counter end={1860} />
              <span className="al-hero__stat-label">Est.</span>
            </div>
          </div>
        </div>
        <div className="al-hero__watermark" aria-hidden="true">SXC</div>
      </div>
    </section>
  );
}
