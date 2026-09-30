'use client';

/**
 * The day's programme, as a compact vertical timeline.
 *
 * Sits between the awardee and the booking section — after the reader knows
 * what the event is and who is being honoured, before they are asked to pay.
 * The ground is ivory, the same as the awardee section, to avoid another
 * background switch for what is really an extension of the same information.
 *
 * The schedule is read from `/data/pages/schedule.ts`, which is transcribed
 * verbatim from the poster SXCCAA supplied. Nothing is paraphrased.
 *
 * The poster itself is displayed full-width below the timeline as a clickable
 * image that opens in the Lightbox, exactly as the other two posters behave.
 */

import { useRef, useState } from 'react';
import { imageSrcSet } from '@/lib/images';
import { Reveal } from '@/components/motion/Reveal';
import { Lightbox } from '@/components/events/Lightbox';
import { schedule, specialInvitee, schedulePoster } from '@/data/pages/schedule';
import { nostalgia } from '@/data/pages/nostalgia';
import { useTilt } from './hooks';

export function ScheduleSection() {
  const poster = useRef<HTMLButtonElement>(null);
  const tilt = useTilt<HTMLDivElement>(5);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  const openPoster = () => {
    const image = poster.current?.querySelector('img');
    setOrigin(image ? image.getBoundingClientRect() : null);
    setOpen(true);
  };

  return (
    <section className="nos-sched" id="nos-schedule" aria-labelledby="nos-sched-heading">
      <div className="nos-sched__glow" aria-hidden="true" />

      <div className="nos-shell nos-sched__shell">
        {/* ---- heading ---- */}
        <div className="nos-sched__head">
          <Reveal as="p" className="nos-eyebrow nos-sched__eyebrow" distance={24}>
            <span className="nos-rule" aria-hidden="true" />
            Program Schedule
          </Reveal>
          <Reveal as="h2" className="nos-title nos-sched__title" delay={0.05}>
            <span id="nos-sched-heading">The Day&rsquo;s Programme</span>
          </Reveal>
          <Reveal as="p" className="nos-sched__sub" delay={0.1} distance={24}>
            Saturday, 3<sup>rd</sup> October 2026 &middot; Taj Santacruz, Mumbai
          </Reveal>
        </div>

        {/* ---- poster (right below the heading) ---- */}
        <Reveal className="nos-sched__poster" delay={0.12} distance={44}>
          <div className="nos-tilt nos-tilt--light" ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
            <button type="button" className="nos-tilt__card" ref={poster} onClick={openPoster}>
              <img
                src={schedulePoster.src}
                srcSet={imageSrcSet(schedulePoster)}
                width={schedulePoster.width}
                height={schedulePoster.height}
                alt={schedulePoster.alt}
                sizes="(max-width: 899.98px) min(calc(100vw - 40px), 500px), min(48vw, 580px)"
                loading="lazy"
                decoding="async"
              />
              <span className="nos-tilt__gloss" aria-hidden="true" />
              <span className="nos-tilt__hint" aria-hidden="true">View full poster</span>
            </button>
          </div>
        </Reveal>

        {/* ---- timeline ---- */}
        <ol className="nos-timeline">
          {schedule.map((evt, i) => (
            <Reveal as="li" className={`nos-evt${evt.highlight ? ' nos-evt--highlight' : ''}`} key={evt.time} delay={0.04 * i} distance={32}>
              <span className="nos-evt__time">{evt.time}</span>
              <div className="nos-evt__card">
                <p className="nos-evt__title">
                  {evt.title}
                  {evt.speaker ? <strong className="nos-evt__speaker"> {evt.speaker}</strong> : null}
                </p>
                {evt.detail ? <p className="nos-evt__detail">{evt.detail}</p> : null}
              </div>
            </Reveal>
          ))}
        </ol>

        {/* ---- special invitee ---- */}
        <Reveal className="nos-invitee" delay={0.14} distance={30}>
          <span className="nos-invitee__label">{specialInvitee.label}</span>
          <p className="nos-invitee__name">{specialInvitee.name}</p>
          <p className="nos-invitee__detail">{specialInvitee.detail}</p>
        </Reveal>
      </div>

      {open ? (
        <Lightbox
          items={[{ image: schedulePoster, title: 'Nostalgia \'26 — Program Schedule', date: nostalgia.date, place: `${nostalgia.venue}, ${nostalgia.city}` }]}
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
