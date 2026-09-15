'use client';

/**
 * The three photographed initiatives, told as one scroll.
 *
 * A tall block with a pinned frame inside it. Scroll position — not a timer —
 * moves through the three chapters: each one's photograph and its text cross
 * over the next, the picture settling out of a slight push-in as it takes
 * focus and drifting on as it loses it. Stop and it holds; scroll back and it
 * runs backwards.
 *
 * Every write is a transform or an opacity, so no frame costs a layout.
 *
 * A chapter is one element holding both its picture and its words, stacked on
 * its siblings. That is what makes the reduced-motion case honest: the
 * stylesheet drops the stacking and the three lay out one under another, three
 * complete chapters rather than three pictures and then three captions.
 */

import { useRef } from 'react';
import { pinned, useScrollLink } from '@/lib/useScrollLink';
import { alumniEvents, storyEventIds, strands as allStrands } from '@/data/pages/events';

const chapters = storyEventIds
  .map((id) => alumniEvents.find((event) => event.id === id))
  .filter((event): event is NonNullable<typeof event> => Boolean(event));

/**
 * Each chapter sits at a point on the scroll — the first at 0, the last at 1 —
 * and `s` is the distance from it, measured so that ±1 is the next chapter's
 * point. Two curves are read off it.
 *
 * The picture crossfades: held for |s| ≤ 0.25, half way out at the midpoint
 * between two chapters, gone by 0.75. Both neighbours are at 0.5 where they
 * meet, so the pair always sums to about one and the frame is never empty.
 *
 * The words do not crossfade. Two headlines dissolving through each other read
 * as a fault, not as a transition, so they hold for |s| ≤ 0.34 and are gone by
 * 0.46 — before the midpoint, not after it, so the two are never legible at
 * the same time and a beat of empty space falls between them.
 */
const PLATE = { hold: 0.25, ramp: 0.5 };
const WORDS = { hold: 0.34, ramp: 0.12 };
const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
const curve = ({ hold, ramp }: { hold: number; ramp: number }, s: number) => clamp((hold + ramp - Math.abs(s)) / ramp);
const strandLabel = (id: string) => allStrands.find((s) => s.id === id)?.label ?? id;

export function EventsStory() {
  const block = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useScrollLink(
    block,
    (p) => {
      pin.current?.style.setProperty('--p', String(p));
      const last = chapters.length - 1;
      for (let i = 0; i <= last; i += 1) {
        const item = items.current[i];
        if (!item) continue;
        const s = (p - i / last) * last;
        const on = curve(PLATE, s);
        item.style.setProperty('--on', String(on));
        item.style.setProperty('--onText', String(curve(WORDS, s)));
        item.style.setProperty('--drift', String(Math.min(Math.max(s, -1), 1)));
        item.style.visibility = on <= 0.001 ? 'hidden' : 'visible';
      }
    },
    pinned(pin),
    [],
    null, // reduced motion is laid out by the stylesheet, not by a progress value
  );

  return (
    <section className="ev-story" aria-label="Photographed initiatives" ref={block}>
      <div className="ev-story__pin" ref={pin}>
        <div className="ev-shell ev-story__frame">
          {/* Fixed while the chapters move under it. Without it the pinned
              viewport is one small composition floating in a screen of nothing;
              with it the screen has a top and a bottom edge, and the space
              between them reads as measured rather than as left over. */}
          <ol className="ev-story__chapters">
            {chapters.map((chapter, i) => (
              <li
                className="ev-story__chapter"
                key={chapter.id}
                ref={(el) => { items.current[i] = el; }}
                style={{ '--on': i === 0 ? 1 : 0, '--onText': i === 0 ? 1 : 0, '--drift': i === 0 ? -0.5 : 1 } as React.CSSProperties}
              >
                <div className="ev-story__copy">
                  <p className="ev-story__index">
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <span className="ev-story__of"> / {String(chapters.length).padStart(2, '0')}</span>
                  </p>
                  <h2 className="ev-story__title">{chapter.title}</h2>
                  <p className="ev-story__meta">
                    {chapter.date}
                    {chapter.place ? ` — ${chapter.place}` : ''}
                  </p>
                  <p className="ev-eyebrow ev-story__strand">{chapter.strands.map(strandLabel).join(' · ')}</p>
                </div>
                <figure className="ev-story__plate">
                  <img
                    src={chapter.images[0].src}
                    width={chapter.images[0].width}
                    height={chapter.images[0].height}
                    alt={chapter.images[0].alt}
                    loading={i === 0 ? undefined : 'lazy'}
                    decoding="async"
                    sizes="(max-width: 809.98px) calc(100vw - 40px), 620px"
                  />
                </figure>
              </li>
            ))}
          </ol>

          <div className="ev-story__progress" aria-hidden="true">
            <span className="ev-story__progressFill" />
          </div>
        </div>
      </div>

      {/* the distance the pinned frame is scrolled through */}
      <div className="ev-story__track" aria-hidden="true" />
    </section>
  );
}
