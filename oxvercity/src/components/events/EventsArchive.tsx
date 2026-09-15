'use client';

/**
 * The archive: every recorded activity, as an editorial list rather than cards.
 *
 * A row is a date set large, a title, a place and the strand it belongs to.
 * Rows carrying photographs raise a plate that follows the pointer — the only
 * place the small supplied files are used at a size they can hold — and rows
 * without say so, because five of the nine have none.
 *
 * Filtering fades the list out over 160ms, swaps the set while nothing is
 * visible, and fades it back with a short stagger. Nothing reflows in view, so
 * there is no jump; and because the rows are re-rendered rather than hidden,
 * the year rules stay right for whatever is showing.
 *
 * The pointer plate is a pointer affordance only: it is `aria-hidden`, it is
 * never the only route to a photograph (the gallery below holds all of them),
 * and it is not raised for a keyboard focus, where a plate chasing a caret
 * would be noise.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { alumniEvents, strands, type DateStamp, type Strand } from '@/data/pages/events';

/**
 * Whatever SXCCAA gave, the largest part of it is set large: the day where
 * there is one, the month where the date was given as a month, the year where
 * it was given as a season. The column is never left standing empty.
 */
function stampParts({ day, month, year }: DateStamp): [string, string | null] {
  if (day) return [day, month ?? year];
  if (month) return [month, year];
  return [year, null];
}

type Filter = Strand | 'all';

export function EventsArchive() {
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState<Filter>('all');
  const list = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // fade out, swap, fade in — the swap happens while the list is invisible
  useEffect(() => {
    if (filter === shown) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setShown(filter); return; }
    const el = list.current;
    if (el) el.dataset.state = 'out';
    const timer = window.setTimeout(() => setShown(filter), 170);
    return () => window.clearTimeout(timer);
  }, [filter, shown]);

  useEffect(() => {
    const el = list.current;
    if (el) el.dataset.state = 'in';
  }, [shown]);

  const rows = useMemo(
    () => (shown === 'all' ? alumniEvents : alumniEvents.filter((e) => e.strands.includes(shown))),
    [shown],
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: alumniEvents.length };
    for (const s of strands) {
      if (s.id === 'all') continue;
      out[s.id] = alumniEvents.filter((e) => e.strands.includes(s.id as Strand)).length;
    }
    return out;
  }, []);

  // the plate rides the pointer; written straight to the transform, no state
  const onMove = (event: React.MouseEvent) => {
    const el = plate.current;
    const box = list.current?.getBoundingClientRect();
    if (!el || !box) return;
    el.style.transform = `translate3d(${event.clientX - box.left}px, ${event.clientY - box.top}px, 0)`;
  };

  const active = hovered ? alumniEvents.find((e) => e.id === hovered) : null;

  let lastYear = '';

  return (
    <section className="ev-archive" id="archive" aria-labelledby="archive-heading">
      <div className="ev-shell">
        <div className="ev-archive__head">
          <h2 className="ev-section-title" id="archive-heading">
            The archive
          </h2>
          <p className="ev-archive__note">{
            'Photographs are shown only where SXCCAA has supplied them. The remaining entries are recorded from the official pages and are awaiting pictures.'
          }</p>
        </div>

        <div className="ev-filters" role="group" aria-label="Filter the archive by strand">
          {strands.map((s) => (
            <button
              key={s.id}
              type="button"
              className="ev-filter"
              aria-pressed={filter === s.id}
              onClick={() => setFilter(s.id as Filter)}
            >
              <span>{s.label}</span>
              <sup>{counts[s.id]}</sup>
            </button>
          ))}
        </div>

        <div className="ev-archive__list" ref={list} data-state="in" onMouseMove={onMove} onMouseLeave={() => setHovered(null)}>
          <ol>
            {rows.map((event) => {
              const year = event.stamp.year;
              const openYear = year !== lastYear;
              lastYear = year;
              return (
                <li className="ev-row" key={event.id} id={event.id} data-photos={event.images.length > 0 ? 'yes' : 'no'}>
                  {openYear ? <p className="ev-row__year" aria-hidden="true">{year}</p> : null}
                  <div
                    className="ev-row__inner"
                    onMouseEnter={() => setHovered(event.images.length ? event.id : null)}
                  >
                    <p className="ev-row__stamp">
                      {(() => {
                        const [large, small] = stampParts(event.stamp);
                        return (
                          <>
                            <span className="ev-row__day" data-wide={large.length > 2 ? 'yes' : undefined}>{large}</span>
                            {small ? <span className="ev-row__month">{small}</span> : null}
                          </>
                        );
                      })()}
                    </p>
                    <div className="ev-row__body">
                      <h3 className="ev-row__title">{event.title}</h3>
                      <p className="ev-row__meta">
                        {event.place}
                        <span className="ev-row__date"> · {event.date}</span>
                      </p>
                      <p className="ev-row__desc">{event.description}</p>
                      <p className="ev-row__links">
                        {event.source ? (
                          <a className="ev-link" href={event.source.href} target="_blank" rel="noreferrer">
                            {event.source.label}
                            <span aria-hidden="true"> ↗</span>
                          </a>
                        ) : null}
                        {event.images.length === 0 ? (
                          <span className="ev-row__awaited">Photographs awaited</span>
                        ) : (
                          <a className="ev-link" href="#gallery">
                            {event.images.length} photograph{event.images.length > 1 ? 's' : ''}
                            <span aria-hidden="true"> ↓</span>
                          </a>
                        )}
                      </p>
                    </div>
                    <p className="ev-row__strand">{event.strands.map((s) => strands.find((x) => x.id === s)?.label).join(' · ')}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="ev-archive__plate" ref={plate} aria-hidden="true" data-on={active ? 'yes' : 'no'}>
            {active ? (
              <img src={active.images[0].src} width={active.images[0].width} height={active.images[0].height} alt="" loading="lazy" decoding="async" sizes="260px" />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
