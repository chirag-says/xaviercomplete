'use client';

/**
 * The two meets the chapter has held or announced: one past, one still to
 * come. No third entry invented to square the grid, and no figures attached to
 * either beyond what the Association has published.
 *
 * Neither poster is shown. The artwork is a record of an event, and /events is
 * where the record lives; repeating it here would have made the chapter's page
 * a second events page. What anchors each entry instead is its year, set very
 * large and outlined — a date is the one thing a record of a meet is really
 * about, and outlined numerals give the section a graphic weight without
 * borrowing a picture to get it.
 *
 * The two sit on a drawn rail with a gold stop at each, which is the network's
 * own language one section later: the arc joined two places, this joins two
 * dates. Hovering or focusing an entry fills its year in solid, grows the rule
 * under the title, steps the arrow out and lifts the metadata into place —
 * every one of them a transform, an opacity or a single colour on one element.
 *
 * Each entry is one link, so there is a single target for a pointer and a
 * single stop for a keyboard, and every hover state is mirrored on focus. The
 * reveal is per-entry rather than per-section, so the second is not already
 * finished by the time it is looked at.
 */

import { useEffect, useRef } from 'react';
import { animate } from 'motion';
import { prefersReducedMotion } from '@/lib/motion';
import { useInView } from '@/lib/useInView';
import { meetsSection, westZone } from '@/data/pages/chapters';
import { upcomingEvent } from '@/data/pages/events';

const RISE = { type: 'tween' as const, duration: 0.95, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

/**
 * Both entries are read from the data the site already holds — the 2023 meet
 * from this page's file, the 2026 one from the events file — so a date only
 * ever has to be corrected in one place.
 */
const MEETS = [
  {
    key: 'nostalgia-23',
    status: 'Held',
    year: '2023',
    title: westZone.meet.title,
    kicker: westZone.meet.subtitle,
    date: westZone.meet.date,
    place: westZone.meet.place,
    href: '#bill',
    action: 'See what the day held',
  },
  {
    key: 'nostalgia-26',
    status: 'Upcoming',
    year: '2026',
    title: upcomingEvent.title,
    kicker: upcomingEvent.subtitle,
    date: upcomingEvent.date,
    place: upcomingEvent.place,
    href: '/events',
    action: 'Read the full listing',
  },
];

function Meet({ meet }: { meet: (typeof MEETS)[number] }) {
  const item = useRef<HTMLLIElement>(null);
  const inView = useInView(item, { threshold: 0.15 });
  const played = useRef(false);

  useEffect(() => {
    const el = item.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      return;
    }
    if (!inView || played.current) return;
    played.current = true;
    // stated from → to, so the reveal does not depend on the gated CSS having
    // landed first; the stylesheet only stops the entry being seen beforehand
    const running = animate(el, { opacity: [0, 1], y: [34, 0] }, RISE);
    return () => running.stop();
  }, [inView]);

  const external = !meet.href.startsWith('#');

  return (
    <li className="cx-meet" ref={item}>
      <a className="cx-meet__link" href={meet.href}>
        <span className="cx-meet__stop" aria-hidden="true" />

        <span className="cx-meet__head">
          <span className="cx-meet__status" data-live={meet.status === 'Upcoming' ? '' : undefined}>
            {meet.status}
          </span>
          <span className="cx-meet__year" aria-hidden="true">
            {meet.year}
          </span>
        </span>

        <span className="cx-meet__body">
          <span className="cx-meet__kicker">{meet.kicker}</span>
          <span className="cx-meet__title">{meet.title}</span>
          <span className="cx-meet__rule" aria-hidden="true" />
          <span className="cx-meet__more">
            <span className="cx-meet__when">
              {meet.date}
              <span className="cx-meet__dot" aria-hidden="true">
                ·
              </span>
              {meet.place}
            </span>
            <span className="cx-meet__action">
              {meet.action}
              <span aria-hidden="true">{external ? '↗' : '↓'}</span>
            </span>
          </span>
        </span>
      </a>
    </li>
  );
}

export function ChapterMeets() {
  return (
    <section className="cx-meets" id="meets" aria-labelledby="meets-heading">
      <div className="ev-shell">
        <div className="cx-meets__head">
          <p className="cx-eyebrow">{meetsSection.eyebrow}</p>
          <h2 className="ev-section-title cx-meets__title" id="meets-heading">
            {meetsSection.title}
          </h2>
        </div>

        <ul className="cx-meets__grid">
          {MEETS.map((meet) => (
            <Meet key={meet.key} meet={meet} />
          ))}
        </ul>
      </div>
    </section>
  );
}
