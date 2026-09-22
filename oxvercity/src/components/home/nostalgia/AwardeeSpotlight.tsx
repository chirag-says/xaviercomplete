'use client';

/**
 * The second poster, and the one name on it.
 *
 * The hero is dark because the invitation is; this is light because the awardee
 * poster is — ivory, navy and gold, the colours of the artwork it carries. The
 * page changing ground here is the point: it marks the move from "what the
 * event is" to "who is being honoured", and it gives the fixed header a light
 * section to sit over after a dark one.
 *
 * The name is the largest thing on the page after the title, which is the
 * hierarchy the poster itself sets. Everything beside it — the three-word
 * billing, the line under it, the SHAKTI block — is printed on that poster and
 * nothing is added to it.
 */

import { useRef, useState } from 'react';
import { imageSrcSet } from '@/lib/images';
import { Reveal } from '@/components/motion/Reveal';
import { Lightbox } from '@/components/events/Lightbox';
import { awardee, awardeePoster, nostalgia } from '@/data/pages/nostalgia';
import { useTilt } from './hooks';

export function AwardeeSpotlight() {
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
    <section className="nos-awardee" id="nos-awardee" aria-labelledby="nos-awardee-name">
      <div className="nos-awardee__glow" aria-hidden="true" />

      <div className="nos-shell nos-awardee__shell">
        <Reveal className="nos-awardee__frame">
          <div className="nos-tilt nos-tilt--light" ref={tilt.ref} onPointerMove={tilt.onPointerMove} onPointerLeave={tilt.onPointerLeave}>
            <button type="button" className="nos-tilt__card" ref={poster} onClick={openPoster}>
              <img
                src={awardeePoster.src}
                srcSet={imageSrcSet(awardeePoster)}
                width={awardeePoster.width}
                height={awardeePoster.height}
                alt={awardeePoster.alt}
                sizes="(max-width: 899.98px) min(calc(100vw - 40px), 460px), min(42vw, 560px)"
                loading="lazy"
                decoding="async"
              />
              <span className="nos-tilt__gloss" aria-hidden="true" />
              <span className="nos-tilt__hint" aria-hidden="true">View full poster</span>
            </button>
          </div>
        </Reveal>

        <div className="nos-awardee__words">
          <Reveal as="p" className="nos-eyebrow nos-awardee__eyebrow" distance={28}>
            <span className="nos-rule" aria-hidden="true" />
            {awardee.eyebrow}
          </Reveal>

          <Reveal as="h2" className="nos-awardee__name" delay={0.06} distance={40}>
            <span id="nos-awardee-name">{awardee.name}</span>
          </Reveal>

          <Reveal as="p" className="nos-awardee__billing" delay={0.12} distance={28}>
            {awardee.billing}
          </Reveal>

          <Reveal as="p" className="nos-awardee__line" delay={0.18} distance={28}>
            {awardee.line}
          </Reveal>

          <Reveal className="nos-shakti" delay={0.24} distance={36}>
            <p className="nos-shakti__name">{awardee.award.name}</p>
            <p className="nos-shakti__title">{awardee.award.title}</p>
            <span className="nos-shakti__rule" aria-hidden="true" />
            <p className="nos-shakti__line">{awardee.award.line}</p>
          </Reveal>

          <Reveal as="p" className="nos-awardee__tagline" delay={0.3} distance={24}>
            {nostalgia.tagline}
          </Reveal>
        </div>
      </div>

      {open ? (
        <Lightbox
          items={[{ image: awardeePoster, title: `${awardee.name} — ${awardee.award.name} ${awardee.award.title}`, date: nostalgia.date, place: `${nostalgia.venue}, ${nostalgia.city}` }]}
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
