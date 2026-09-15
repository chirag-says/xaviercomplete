'use client';

/**
 * The stage the page now opens on: the one activity that has not happened yet.
 *
 * Everything else on /events is a record of something finished. This is the
 * only thing a reader can still act on, so it takes the whole first screen
 * rather than a column beside a headline — the poster at the size the artwork
 * was drawn for, and every detail on it set beside it as text.
 *
 * The ground is taken from the poster itself: sampling the file gives #140c27
 * over nearly two-thirds of it, with gold and warm purple through the rest.
 * Drawing the stage in those colours makes the artwork sit in the page instead
 * of on it, and gives the header something dark to be white against — the same
 * arrangement the home hero uses, down to the 1px scroll trigger that flips the
 * bar to its solid state on the first scroll.
 *
 * The details are the ones printed on the poster and already recorded in the
 * data file. The prices and the bank account on the artwork stay in the
 * artwork, deliberately: showing the Association's poster is one thing, setting
 * their account number as machine-readable text on a public page is another.
 *
 * The countdown is arithmetic on the supplied date, not a claim: it is
 * computed after mount so the server and the client cannot disagree about what
 * day it is, and it says nothing once the date has passed.
 */

import { useEffect, useRef, useState } from 'react';
import { imageSrcSet } from '@/lib/images';
import { eventsPage, upcomingEvent } from '@/data/pages/events';
import { Lightbox } from './Lightbox';

/** Whole days from today to the event, or null before mount / once it is past. */
function useDaysUntil(iso: string): number | null {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const [y, m, d] = iso.split('-').map(Number);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const left = Math.round((Date.UTC(y, m - 1, d) - today) / 86_400_000);
    setDays(left >= 0 ? left : null);
  }, [iso]);
  return days;
}

function Countdown({ days }: { days: number | null }) {
  if (days === null) return null;
  return (
    <p className="ev-stage__count">
      <span className="ev-stage__countNum">{days === 0 ? 'Today' : days}</span>
      {days === 0 ? null : <span className="ev-stage__countWord">{days === 1 ? 'day to go' : 'days to go'}</span>}
    </p>
  );
}

export function EventsUpcoming() {
  const poster = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  const days = useDaysUntil(upcomingEvent.iso);

  const facts = [
    { label: 'Date', value: upcomingEvent.date },
    { label: 'Time', value: upcomingEvent.time },
    { label: 'Venue', value: upcomingEvent.place },
  ];

  return (
    <section className="ev-stage" aria-labelledby="upcoming-heading">
      {/* the header is white over this section and solid from the first scroll */}
      <div aria-hidden="true" className="ev-stage__trigger" id="scroll-trigger" />

      <div className="ev-shell ev-stage__shell">
        {/* the page's own name, centred across both columns above them, so it
            reads as the title of the page rather than a label on the poster */}
        <p className="ev-eyebrow ev-stage__page">{eventsPage.eyebrow}</p>

        <div className="ev-stage__words">
          <p className="ev-eyebrow ev-stage__label">
            <span className="ev-stage__dot" aria-hidden="true" />
            Next event · {upcomingEvent.host}
          </p>

          <h2 className="ev-stage__title" id="upcoming-heading">
            <span className="ev-stage__line"><span className="ev-stage__rise">Nostalgia&nbsp;’26</span></span>
            <span className="ev-stage__line"><span className="ev-stage__rise" style={{ animationDelay: '0.09s' }}>cum Shakti</span></span>
          </h2>

          <p className="ev-stage__sub">{upcomingEvent.subtitle}</p>
          <p className="ev-stage__lede">{upcomingEvent.lede}</p>

          <Countdown days={days} />

          <dl className="ev-stage__facts">
            {facts.map((fact) => (
              <div className="ev-stage__fact" key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="ev-stage__actions">
            <button
              type="button"
              className="ev-stage__cta"
              onClick={() => {
                const img = poster.current?.querySelector('img');
                setOrigin(img ? img.getBoundingClientRect() : null);
                setOpen(true);
              }}
            >
              View full poster
              <span aria-hidden="true">↗</span>
            </button>
            <a className="ev-stage__cta ev-stage__cta--quiet" href="/contact">
              Ask about attending
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div className="ev-stage__frame">
          <button
            type="button"
            className="ev-stage__poster"
            ref={poster}
            onClick={(event) => {
              const img = event.currentTarget.querySelector('img');
              setOrigin(img ? img.getBoundingClientRect() : null);
              setOpen(true);
            }}
          >
            <img
              src={upcomingEvent.poster.src}
              srcSet={imageSrcSet(upcomingEvent.poster)}
              width={upcomingEvent.poster.width}
              height={upcomingEvent.poster.height}
              alt={upcomingEvent.poster.alt}
              sizes="(max-width: 899.98px) min(calc(100vw - 40px), 400px), min(32vw, 450px)"
              fetchPriority="high"
              decoding="async"
            />
            <span className="ev-stage__zoom" aria-hidden="true">View poster</span>
          </button>
        </div>
      </div>

      {open ? (
        <Lightbox
          items={[{ image: upcomingEvent.poster, title: upcomingEvent.title, date: upcomingEvent.date, place: upcomingEvent.place }]}
          index={0}
          origin={origin}
          onClose={() => {
            setOpen(false);
            setOrigin(null);
            poster.current?.focus();
          }}
          onStep={() => undefined}
        />
      ) : null}
    </section>
  );
}
