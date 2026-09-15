'use client';

/**
 * The opening screen. The poster is the page, so it leads, and everything set
 * around it is deliberately small — a masthead rather than a headline. The
 * artwork is the largest thing on the first screen by a long way, and that is
 * the whole point of the composition.
 *
 * THE REVEAL
 *
 * Five things happen, none of them a fade, and all of them compositor work:
 *
 *   1. The frame opens like an aperture. A `clip-path` inset runs from a
 *      closed horizontal line at the centre out to the full box, so the poster
 *      is uncovered from the middle rather than wiped in from an edge. Because
 *      `clip-path` clips the element's shadow too, the frame's shadow arrives
 *      with it and the artwork appears to lift off the page as it opens.
 *   2. The picture inside settles back from 1.18 to 1.06 over a longer
 *      duration, so it is still moving after the window has finished — the
 *      artwork lands in the frame instead of arriving with it.
 *   3. One sheen crosses the poster, once, a beat after the window is open: a
 *      narrow raking highlight on `screen`, gone in a second and a half and
 *      leaving nothing behind (`both` holds it at zero opacity afterwards).
 *   4. Four hairline corner marks draw in last, like a viewfinder closing on
 *      the artwork.
 *   5. Then scroll takes over, and the picture pans against the page.
 *
 * The settle is on the `<img>` and the pan is on a wrapper, because one
 * element cannot carry a keyframed transform and a scroll-written one at the
 * same time. The image is held at 1.06 at rest so the pan can never uncover an
 * edge inside the frame.
 *
 * All of it is CSS, so the whole opening runs with no script at all; what
 * scripting adds is the pan and the full-size viewer. Reduced motion gets the
 * finished composition with none of it.
 */

import { useRef, useState } from 'react';
import { imageSrcSet } from '@/lib/images';
import { useSmoothScrollLink } from '@/lib/useSmoothScrollLink';
import { Lightbox } from '@/components/events/Lightbox';
import { chaptersPage, westZone } from '@/data/pages/chapters';

/** The weave. Each entry is one arc's vertical placing and how deep it bows. */
const ARCS = Array.from({ length: 16 }, (_, i) => ({
  y: 40 + i * 58,
  bow: 118 - i * 4,
  delay: 0.5 + i * 0.055,
}));

/** The viewfinder marks, in the order they are drawn. */
const MARKS = ['tl', 'tr', 'bl', 'br'];

/**
 * The frame is capped by the viewport's height as much as its width, so the
 * poster lands whole inside the first screen. It is never wider than the
 * measure, and rarely that wide on a laptop.
 */
const SIZES = '(max-width: 809.98px) calc(100vw - 40px), min(calc(100vw - 80px), 1296px, 96svh)';

export function ChapterStage() {
  const stage = useRef<HTMLElement>(null);
  const figure = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<DOMRect | null>(null);

  useSmoothScrollLink(
    stage,
    (progress) => {
      stage.current?.style.setProperty('--exit', String(progress));
    },
    (element) => ({ start: element.getBoundingClientRect().top + window.scrollY, length: window.innerHeight }),
    [],
    0,
  );

  return (
    <section className="cx-stage" aria-labelledby="chapters-title" ref={stage}>
      {/* the header is white over this section, and turns solid on the first scroll */}
      <div aria-hidden="true" className="cx-stage__trigger" id="scroll-trigger" />

      <div className="cx-stage__ground" aria-hidden="true">
        <img
          className="cx-stage__crest"
          src="/images/brand/crest.png"
          alt=""
          width={755}
          height={900}
          decoding="async"
          fetchPriority="low"
        />
        <svg className="cx-stage__weave" viewBox="0 0 1440 940" preserveAspectRatio="none" aria-hidden="true">
          {ARCS.map((arc) => (
            <path
              key={arc.y}
              d={`M -120 ${arc.y} C 340 ${arc.y - arc.bow}, 1100 ${arc.y + arc.bow}, 1560 ${arc.y}`}
              /* normalised, so one dash offset draws every arc whatever the width */
              pathLength={1}
              style={{ animationDelay: `${arc.delay}s` }}
            />
          ))}
        </svg>
        <span className="cx-stage__grain" />
        <span className="cx-stage__fade" />
      </div>

      <div className="ev-shell cx-stage__shell">
        <div className="cx-stage__masthead">
          <p className="cx-stage__eyebrow">
            <span className="cx-stage__pip" aria-hidden="true" />
            {chaptersPage.eyebrow}
          </p>

          <h1 className="cx-stage__title" id="chapters-title">
            <span className="cx-stage__rise">{chaptersPage.headline.join(' ')}</span>
          </h1>

          {/* What the poster is for, and the one large piece of type on this
              screen. It leads on the left with the statement set small against
              it on the right; the stylesheet places both, so the heading can
              still come first in the source. It also says what the line under
              the poster used to, which is why that line is gone. */}
          <p className="cx-stage__chapter">{westZone.meet.subtitle}</p>
        </div>

        <button
          type="button"
          className="cx-stage__frame"
          ref={figure}
          onClick={() => {
            const img = figure.current?.querySelector('img');
            setOrigin(img ? img.getBoundingClientRect() : null);
            setOpen(true);
          }}
        >
          <span className="cx-stage__pan">
            <img
              className="cx-stage__poster"
              src={westZone.poster.src}
              srcSet={imageSrcSet(westZone.poster)}
              sizes={SIZES}
              width={westZone.poster.width}
              height={westZone.poster.height}
              alt={westZone.poster.alt}
              fetchPriority="high"
              decoding="async"
            />
          </span>

          <span className="cx-stage__sheen" aria-hidden="true" />
          {MARKS.map((corner, i) => (
            <span
              className="cx-stage__mark"
              key={corner}
              data-corner={corner}
              aria-hidden="true"
              style={{ animationDelay: `${0.98 + i * 0.07}s` }}
            />
          ))}

          <span className="cx-stage__view">
            {chaptersPage.posterCue}
            <span aria-hidden="true">↗</span>
          </span>
        </button>

        <div className="cx-stage__foot">
          <a className="cx-stage__cue" href="#meets">
            <span className="cx-stage__cueRing" aria-hidden="true">
              <span className="cx-stage__cueArrow">↓</span>
            </span>
            {chaptersPage.cue}
          </a>
        </div>
      </div>

      <dl className="cx-rail">
        {chaptersPage.rail.map((item, i) => (
          <div className="cx-rail__cell" key={item.key} style={{ animationDelay: `${0.72 + i * 0.09}s` }}>
            <dt className="cx-rail__label">{item.label}</dt>
            <dd className="cx-rail__value">
              <span className="cx-rail__figure">{item.figure}</span>
              <span className="cx-rail__word">{item.value}</span>
            </dd>
          </div>
        ))}
      </dl>

      {open ? (
        <Lightbox
          items={[
            {
              image: westZone.poster,
              title: westZone.meet.title,
              date: westZone.meet.date,
              place: westZone.meet.place,
            },
          ]}
          index={0}
          origin={origin}
          onClose={() => setOpen(false)}
          onStep={() => undefined}
        />
      ) : null}
    </section>
  );
}
