'use client';

/**
 * "Voices From Our Community" — the scroll-driven review section above the footer.
 *
 * Scroll is the only thing that moves this section. There is no timer, no
 * interval, no autoplay: the component writes a single number, `--sx-p`, on the
 * pinned stage, and every card's animation is scrubbed to that number. Stop
 * scrolling and the composition holds exactly where it is; scroll back and it
 * runs backwards.
 *
 * How the reference recording behaves, measured frame by frame at 25fps:
 *
 *   - The section pins. Over the 5.3s the cards are on screen, the background
 *     is pixel-identical (mean frame difference 1.0 of 255, which is video
 *     compression noise); at 5.44s it jumps to 10.6 as the page releases and
 *     scrolls on. So the photograph and the title are a fixed stage, and only
 *     the cards move against it.
 *   - Cards alternate between two lanes hugging the edges: 439px wide, 50px
 *     from the viewport edge at 1916px — 22.9% and 2.6%. The reference has two
 *     reviews to show and this site has three, so the third returns to the
 *     right-hand lane.
 *   - A card rises from behind the clipped bottom edge, settles with its centre
 *     ~61% down the stage, holds, then is released upward and dissolves. It
 *     does not fade in: its brightest row measures a flat ~137 from the moment
 *     it clears the edge until two thirds of the way through.
 *   - The second card starts its rise at 79% of the first card's pass, so the
 *     two share the stage for the last fifth of the first one's life.
 *   - Width and height never change: no scale, no rotation.
 *
 * The velocities in the recording are uneven — 500px/s, then a near-stop, then
 * 1500px/s. That is not easing in the source; it is the pace of the hand on the
 * trackpad. Mapping the same path onto scroll progress reproduces it exactly,
 * because the pace becomes the visitor's again.
 */

import { useEffect, useRef } from 'react';
import { voices } from '@/data/voices';

/**
 * In the reference, the next card begins rising when the one before it is 79%
 * through its pass — which is what puts two of them on the stage together for
 * the last fifth of the older one's life.
 */
const HANDOVER = 0.79;

/**
 * Each card's slice of the section's 0 → 1 scroll progress, derived from that
 * one ratio and the number of reviews. `n` passes of equal length `s`, each
 * starting `0.79s` after the last, fill the track when `0.79s(n-1) + s = 1`.
 * Three reviews therefore give `s = 0.388` and starts at 0, 0.306 and 0.612;
 * two would give 0.559. Nothing needs re-tuning if a review is added or
 * dropped.
 */
const SPAN = 1 / (1 + HANDOVER * (voices.length - 1));
const STARTS = voices.map((_, i) => i * HANDOVER * SPAN);

/**
 * Initials for the monogram. Both surnames here begin with S, so a single
 * letter would give Snehal Garg and Shivam Mehra the same disc.
 */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
}

export function VoicesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    if (!section || !pin) return;

    let frame = 0;
    let last = -1;
    /* Skips the work while the section is nowhere near the viewport. It starts
     * true, not false: an IntersectionObserver does not deliver its first
     * callback until after the frame it was created in, and starting closed
     * would drop any scroll that arrives in the meantime — which is exactly
     * what happens when a page is restored part-way down this section. */
    let live = true;

    const measure = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      /* How far the section can scroll while the stage stays pinned. */
      const travel = section.offsetHeight - pin.offsetHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      /* Three decimals is finer than a single scrolled pixel can resolve, and
       * skipping the write when nothing changed keeps an idle page idle. */
      const next = Math.round(p * 1000) / 1000;
      if (next === last) return;
      last = next;
      pin.style.setProperty('--sx-p', String(next));
    };

    const onScroll = () => {
      if (!live || frame) return;
      frame = requestAnimationFrame(measure);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        live = entry.isIntersecting;
        if (live) measure();
      },
      /* Start listening a screen early so the first frame is already correct. */
      { rootMargin: '100% 0px' },
    );
    observer.observe(section);

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} className="sx-voices" data-framer-name="Community Voices Section" aria-labelledby="sx-voices-title">
      <div ref={pinRef} className="sx-voices__pin">
        <div className="sx-voices__bg">
          <picture>
            <img
              src="/images/home/voices-bg.png"
              sizes="100vw"
              width={1666}
              height={944}
              alt="The gate of St. Xaviers College (Calcutta), Raghabpur campus, at dusk"
              decoding="async"
              loading="lazy"
            />
          </picture>
        </div>

        <div className="sx-voices__centre">
          <h2 id="sx-voices-title" className="framer-text framer-styles-preset-1tiwwlt" data-styles-preset="WXi_OMzDz">
            {'Voices From Our Community'}
          </h2>
          <p className="sx-voices__standfirst">
            {'Stories, experiences and memories that continue to connect generations of Xaverians.'}
          </p>
        </div>

        {/* The moving layer. Each card's animation is paused and seeked by a
         * negative delay derived from `--sx-p`, so scrolling is the only thing
         * that advances it. The quotes are also listed in full below for
         * assistive technology, which has no scroll position to follow. */}
        <div className="sx-voices__field" aria-hidden="true">
          {voices.map((voice, i) => (
            <div
              key={voice.name}
              className="sx-voices__slot"
              /* Alternating sides, as in the reference. */
              data-side={i % 2 === 0 ? 'right' : 'left'}
              style={{ '--sx-start': String(STARTS[i]), '--sx-span': String(SPAN) } as React.CSSProperties}
            >
              <article className="sx-voice">
                <p className="sx-voice__quote">{`“${voice.comment}”`}</p>
                <span className="sx-voice__monogram">{initials(voice.name)}</span>
                <p className="sx-voice__name">{voice.name}</p>
                {voice.role ? <p className="sx-voice__role">{voice.role}</p> : null}
              </article>
            </div>
          ))}
        </div>

        <ul className="sx-voices__transcript">
          {voices.map((voice) => (
            <li key={voice.name}>
              <blockquote>{voice.comment}</blockquote>
              <cite>{[voice.name, voice.role].filter(Boolean).join(' — ')}</cite>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
