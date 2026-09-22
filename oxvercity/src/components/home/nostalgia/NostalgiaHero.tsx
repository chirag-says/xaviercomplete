'use client';

/**
 * The landing: an engraved invitation, and the poster is the thing on it.
 *
 * This opened on the same plum-and-gold ground the /events stage uses, and the
 * two screens read as one screen shown twice. It is inverted now, for two
 * reasons that point the same way.
 *
 * The first is the artwork. The invitation poster is dark — deep plum, gold
 * flare, a night crowd. On a dark ground its edges dissolve and it stops being
 * an object in the page. On champagne it reads as one, and it needs nothing
 * else: it is a designed object that arrived with its own border and its own
 * ground, so it stands on the paper the way the awardee poster below it does,
 * with a soft navy shadow and a gold hairline ring and no panel behind it.
 *
 * The second is that the page is the front door and /events is a record. They
 * should not open the same way.
 *
 * The ground is drawn, not photographed: a champagne wash, an engraved 88px
 * hairline grid that fades out before the foot, a slow gold bloom behind the
 * poster, and eighteen gold motes on long offset drifts — fewer and fainter
 * than a dark ground can carry, because on light anything quicker reads as
 * dust on the screen rather than in the room. All four are CSS; nothing here
 * loads an image except the poster itself.
 *
 * The poster takes the wider of the two columns and is sized off the viewport
 * HEIGHT rather than its width, so it is as large as each screen can hold
 * without pushing "Book your seat" under the fold. It is uncovered on load by
 * a band of gold light, breathes on an eleven-second cycle, catches a sweep of
 * foil on the same cycle, and rotates a few degrees toward the pointer with a
 * sheen that tracks it. Nothing about the content depends on any of that: it
 * is a flat, still image on a phone, under reduced motion, and to a screen
 * reader, which gets the poster's full alt text and then every detail on it
 * again as real text beside it.
 *
 * Because the hero is light, the page passes `lightPage` to `SiteShell` so the
 * header opens with ink type rather than white. The 1px `#scroll-trigger`
 * below still flips it to its solid state on the first scroll.
 */

import { useRef, useState } from 'react';
import { imageSrcSet } from '@/lib/images';
import { prefersReducedMotion } from '@/lib/motion';
import { Lightbox } from '@/components/events/Lightbox';
import { invitePoster, nostalgia, registration } from '@/data/pages/nostalgia';
import { useCountdown, useTilt } from './hooks';

/** The dust. Each speck gets a lane, a size, a delay and a duration. */
const DUST = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  size: `${1 + ((i * 7) % 3)}px`,
  delay: `${-(i * 1.7) % 22}s`,
  duration: `${16 + ((i * 5) % 11)}s`,
  drift: `${((i % 5) - 2) * 18}px`,
}));

function Countdown({ iso }: { iso: string }) {
  const left = useCountdown(iso);
  if (!left) return null;

  const parts = [
    { value: left.days, label: left.days === 1 ? 'day' : 'days' },
    { value: left.hours, label: left.hours === 1 ? 'hour' : 'hours' },
    { value: left.minutes, label: left.minutes === 1 ? 'minute' : 'minutes' },
    { value: left.seconds, label: left.seconds === 1 ? 'second' : 'seconds' },
  ];

  return (
    <div className="nos-count" role="timer" aria-label={`${left.days} days, ${left.hours} hours, ${left.minutes} minutes and ${left.seconds} seconds until Nostalgia ’26`}>
      {parts.map((part, i) => (
        <div className="nos-count__cell" key={part.label} style={{ '--i': i } as React.CSSProperties}>
          <span className="nos-count__num" aria-hidden="true">{String(part.value).padStart(2, '0')}</span>
          <span className="nos-count__word" aria-hidden="true">{part.label}</span>
        </div>
      ))}
    </div>
  );
}

export function NostalgiaHero() {
  const poster = useRef<HTMLButtonElement>(null);
  const tilt = useTilt<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  const facts = [
    { label: 'Date', value: nostalgia.date },
    { label: 'Time', value: nostalgia.time },
    { label: 'Venue', value: `${nostalgia.venue}, ${nostalgia.city}` },
  ];

  const openPoster = () => {
    const image = poster.current?.querySelector('img');
    setOrigin(image ? image.getBoundingClientRect() : null);
    setOpen(true);
  };

  /**
   * Eases the two in-page jumps instead of cutting to them, and leaves the URL
   * hash in place so the link is still a link — copyable, openable in a new
   * tab, and working with the script off.
   *
   * `scroll-behavior: smooth` would be one CSS line, but it has to go on the
   * scrolling element — `html` — which every other page shares. This keeps it
   * to the two links that want it. A reader who has asked for less motion gets
   * the browser's instant jump.
   */
  const jump = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.querySelector(event.currentTarget.getAttribute('href') ?? '');
    if (!target || prefersReducedMotion()) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', event.currentTarget.getAttribute('href'));
  };

  return (
    <section className="nos-hero" aria-labelledby="nos-hero-title">
      {/* the header is white over this section and flips solid on the first scroll */}
      <div aria-hidden="true" className="nos-hero__trigger" id="scroll-trigger" />

      <div className="nos-hero__wash" aria-hidden="true" />
      <div className="nos-hero__grid" aria-hidden="true" />
      <div className="nos-hero__bloom" aria-hidden="true" />
      <div className="nos-hero__dust" aria-hidden="true">
        {DUST.map((speck, i) => (
          <span
            key={i}
            style={{
              left: speck.left,
              width: speck.size,
              height: speck.size,
              animationDelay: speck.delay,
              animationDuration: speck.duration,
              '--drift': speck.drift,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="nos-hero__college">
        <p className="nos-hero__collegeName">St. Xaviers College (Calcutta)</p>
        <p className="nos-hero__chapterName">Alumni Association — West Zone Chapter</p>
      </div>

      <div className="nos-shell nos-hero__shell">
        <div className="nos-hero__words">
          <h1 className="nos-hero__title" id="nos-hero-title">
            <span className="nos-hero__line">
              <span className="nos-hero__rise">{nostalgia.title[0]}</span>
            </span>
            {/* the two lines are blocks, so this space collapses on screen — it
                is here so the accessible name is not "Nostalgia ’26cum Shakti" */}
            {' '}
            <span className="nos-hero__line nos-hero__line--script">
              <span className="nos-hero__rise" style={{ animationDelay: '0.1s' }}>{nostalgia.title[1]}</span>
            </span>
          </h1>

          <p className="nos-hero__award">{nostalgia.award}</p>
          <p className="nos-hero__lede">{nostalgia.lede}</p>

          <Countdown iso={nostalgia.iso} />

          <dl className="nos-hero__facts">
            {facts.map((fact) => (
              <div className="nos-hero__fact" key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="nos-hero__actions">
            <a className="nos-cta" href="#nos-passes" onClick={jump}>
              <span>Book your seat</span>
              <span aria-hidden="true" className="nos-cta__arrow">→</span>
            </a>
            <button type="button" className="nos-cta nos-cta--quiet" onClick={openPoster}>
              <span>View the invitation</span>
              <span aria-hidden="true" className="nos-cta__arrow">↗</span>
            </button>
          </div>

          <p className="nos-hero__price">
            {registration.label} <strong>{registration.amount}</strong> <span>{registration.tax}</span>
            <span className="nos-hero__priceNote">{registration.note}</span>
          </p>
        </div>

        <div className="nos-hero__frame">
          <div className="nos-tilt nos-tilt--light" ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
            <button type="button" className="nos-tilt__card" ref={poster} onClick={openPoster}>
              <img
                src={invitePoster.src}
                srcSet={imageSrcSet(invitePoster)}
                width={invitePoster.width}
                height={invitePoster.height}
                alt={invitePoster.alt}
                sizes="(max-width: 899.98px) min(calc(100vw - 40px), 440px), min(42vw, 500px)"
                fetchPriority="high"
                decoding="async"
              />
              <span className="nos-tilt__gloss" aria-hidden="true" />
              <span className="nos-tilt__hint" aria-hidden="true">View full poster</span>
            </button>
          </div>
        </div>
      </div>

      <a className="nos-hero__cue" href="#nos-awardee" onClick={jump}>
        <span>The awardee</span>
        <span className="nos-hero__cueLine" aria-hidden="true" />
      </a>

      {open ? (
        <Lightbox
          items={[{ image: invitePoster, title: nostalgia.titlePlain, date: nostalgia.date, place: `${nostalgia.venue}, ${nostalgia.city}` }]}
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
