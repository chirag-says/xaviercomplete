'use client';

/**
 * The page's opening: a typographic statement against the one activity that has
 * not happened yet, then the archive's widest photograph opening from a mask.
 *
 * Type leads rather than a full-bleed photograph, for a reason that is about
 * the material and not about taste. SXCCAA has supplied six pictures for nine
 * past events, and the largest is 1121px across; blown across a 1440px hero it
 * would be visibly soft, and a soft photograph at the top of a page reads as a
 * cheap page. So the words carry the opening, and the photograph is held to a
 * band no wider than its own file — where it is sharp, and where the mask
 * makes arriving at it an event.
 *
 * The Nostalgia ’26 poster used to sit in a column on the right. It now opens
 * the page on its own stage above this block (`EventsUpcoming`), because it is
 * the only thing on the page a reader can still act on and it was being read
 * as a sidebar. What is left here is the retrospective's own opening.
 *
 * The mask on the band is scroll-linked, not timed: it opens from the centre
 * as the reader comes down to it, and closes again on the way back up.
 */

import { useRef } from 'react';
import { crossing, useScrollLink } from '@/lib/useScrollLink';
import { alumniEvents, eventsPage, leadEventId } from '@/data/pages/events';

const lead = alumniEvents.find((event) => event.id === leadEventId)!;
const plate = lead.images[0];

export function EventsHero() {
  const band = useRef<HTMLDivElement>(null);

  useScrollLink(
    band,
    (p) => {
      // the mask opens from the centre; the picture inside settles out of a
      // slight push-in, so the two move against each other rather than together
      band.current?.style.setProperty('--open', String(p));
    },
    crossing(0.95, 0.45),
  );

  return (
    <header className="ev-hero" id="events-hero">
      <div className="ev-shell ev-hero__top">
        <div className="ev-hero__words">
          <p className="ev-eyebrow">{eventsPage.recordEyebrow}</p>
          <h1 className="ev-hero__headline">
            {eventsPage.headline.map((line, i) => (
              <span className="ev-hero__line" key={line}>
                <span className="ev-hero__word" style={{ animationDelay: `${0.08 + i * 0.09}s` }}>
                  {line}
                </span>
              </span>
            ))}
          </h1>
          <p className="ev-hero__intro">{eventsPage.intro}</p>
        </div>

      </div>

      <div className="ev-shell">
        <figure className="ev-hero__band" ref={band}>
          <div className="ev-hero__mask">
            <img
              src={plate.src}
              width={plate.width}
              height={plate.height}
              alt={plate.alt}
              fetchPriority="high"
              decoding="async"
              sizes="(max-width: 809.98px) calc(100vw - 40px), min(1121px, 86vw)"
            />
          </div>
          <figcaption className="ev-hero__caption">
            <span className="ev-rule" aria-hidden="true" />
            <span>{lead.title}</span>
            <span className="ev-hero__capdot" aria-hidden="true">·</span>
            <span>{lead.place}</span>
            <span className="ev-hero__capdot" aria-hidden="true">·</span>
            <span>{lead.date}</span>
          </figcaption>
        </figure>
      </div>

    </header>
  );
}
