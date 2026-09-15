'use client';

/**
 * "What we stand for" — the mission / vision / legacy accordion on the about
 * page. Exactly one panel is open, as on the Explore accordion, and opening
 * one closes the other.
 *
 * The panel grows from 0 to its measured height over 0.5s on Framer's own
 * variant easing, and the body fades up behind it: the summary first, then the
 * points one after another. Everything else — the border lighting up, the
 * ordinal, the plus turning into a cross — is a colour or transform transition
 * of the same length, so the whole card settles at once.
 *
 * The open card is marked by the site's own accent, `--sx-accent` (white on
 * the dark ground). Changing that one custom property in `site.css` recolours
 * every open state.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { pillars, pillarsHeading, type Pillar } from '@/data/pages/about';
import { Reveal } from '@/components/motion/Reveal';
import { SectionHeading } from './SectionHeading';

function PillarItem({ item, open, onOpen }: { item: Pillar; open: boolean; onOpen: () => void }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [measured, setMeasured] = useState(false);

  // Keep the open panel's height in step with its content: the text reflows on
  // resize, and the fonts land after first paint.
  useLayoutEffect(() => {
    const element = inner.current;
    if (!element) return;
    const measure = () => setHeight(Math.ceil(element.getBoundingClientRect().height));
    measure();
    setMeasured(true);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Before the first measurement the open panel is left at `auto`, so the
  // server render is already the right height and nothing animates on load.
  const panelHeight = open ? (measured ? `${height}px` : 'auto') : '0px';

  return (
    <div className={`sx-pillar${open ? ' is-open' : ''}`} id={item.id} data-open={open}>
      <button
        type="button"
        className="sx-pillar__header"
        aria-expanded={open}
        aria-controls={`${item.id}-panel`}
        onClick={onOpen}
      >
        <span className="sx-pillar__ordinal">{item.ordinal}</span>
        <span className="sx-pillar__title framer-text framer-styles-preset-11yr44y">{item.title}</span>
        <span className="sx-pillar__icon" aria-hidden="true">
          <span className="sx-pillar__bar" />
          <span className="sx-pillar__bar" />
        </span>
      </button>
      <div className="sx-pillar__panel" id={`${item.id}-panel`} role="region" style={{ height: panelHeight }} aria-hidden={!open}>
        <div className="sx-pillar__inner" ref={inner}>
          <p className="sx-pillar__summary framer-text framer-styles-preset-1s2szaz">{item.summary}</p>
          <ul className="sx-pillar__points">
            {item.points.map((point, i) => (
              <li key={point} className="framer-text framer-styles-preset-1s2szaz" style={{ '--i': i } as React.CSSProperties}>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function PillarsSection() {
  const [open, setOpen] = useState(0);

  return (
    <section className="sx-section sx-section--dark sx-section--screen" data-framer-name="Pillars Section" id="pillars">
      <div className="sx-container">
        <div className="sx-content sx-pillars">
          <div className="sx-pillars__head">
            <SectionHeading eyebrow={pillarsHeading.eyebrow} lines={pillarsHeading.lines} dark />
          </div>
          <div className="sx-pillars__list">
            {pillars.map((item, i) => (
              <Reveal key={item.id} delay={0.1 * i} distance={40}>
                <PillarItem item={item} open={i === open} onOpen={() => setOpen(i)} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
