'use client';

/**
 * Framer's Slideshow component as configured on the home page: one slide at a
 * time, 24px gap, neighbours scaled to 0.8 with a 600px perspective, arrows at
 * the top right (60px, offset -200px into the heading row), no autoplay, no
 * drag. The slide track moves on a spring of stiffness 200 / damping 40.
 *
 * Like the original, the slides are repeated four times and the track starts
 * on the second copy, so there is always a neighbour on both sides; after each
 * move the track re-centres without animation when it reaches an outer copy.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { animate, type AnimationPlaybackControls } from 'motion';
import { tokens } from '@/lib/tokens';
import { SlideMedia } from './SlideMedia';
import type { FacultySlide } from '@/data/pages/home';

const GAP = 24;
const COPIES = 4;
const SCALE = 0.8;
const SPRING = { type: 'spring' as const, stiffness: 200, damping: 40, mass: 1 };
const VARIANT = {
  desktop: { slots: ['framer-ys4093-container', 'framer-i7vr9z-container', 'framer-11c6hqe-container'], cls: 'framer-v-1qbswss', name: 'Desktop', pill: 'framer-v-1pdemgs', pillName: 'Default', fill: false, arrow: 60, arrowTop: -200 },
  tablet: { slots: ['framer-1k4yv1u-container', 'framer-bmh1x-container', 'framer-1xcb8ej-container'], cls: 'framer-v-hwi51f', name: 'Tablet', pill: 'framer-v-1csj9wd', pillName: 'Phone', fill: true, arrow: 48, arrowTop: -140 },
} as const;
type Variant = keyof typeof VARIANT;

function SlideCard({ slide, variant }: { slide: FacultySlide; variant: Variant }) {
  const v = VARIANT[variant];
  return (
    <div className={`framer-FtBy4 framer-QNdG4 framer-RqKzS framer-1qbswss ${v.cls}`} data-framer-name={v.name} style={{ ...(v.fill ? { height: '100%' } : {}), width: '100%', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
      <div className="framer-112po6y" data-framer-name="Image Wrap">
        <SlideMedia image={slide.image} />
        <div className="framer-440jsc" data-framer-name="BG Overlay" style={{ background: `linear-gradient(180deg, var(--token-fe810758-ba26-4c60-a7b7-193cf95cf6ce, rgba(255, 255, 255, 0)) 0%, ${tokens.ink70} 100%)` }} />
      </div>
      <div className="framer-1642ta9" data-framer-name="Content Wrapper">
        <div className="framer-ap9mjb-container">
          <div className={`framer-O2QIe framer-yylGA framer-1pdemgs ${v.pill}`} data-border="true" data-framer-name={v.pillName} style={{ '--border-bottom-width': '0.6000000238418579px', '--border-color': tokens.white, '--border-left-width': '0.6000000238418579px', '--border-right-width': '0.6000000238418579px', '--border-style': 'solid', '--border-top-width': '0.6000000238418579px', backgroundColor: tokens.white10, borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px', borderTopLeftRadius: '30px', borderTopRightRadius: '30px' } as CSSProperties}>
            <div className="framer-11s2jci" data-framer-name="Title" data-framer-component-type="RichTextContainer" style={{ '--extracted-r6o4lv': tokens.white, '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties}>
              <p className="framer-text framer-styles-preset-c29y5p" data-styles-preset="MIzrA6q79" style={{ '--framer-text-color': `var(--extracted-r6o4lv, ${tokens.white})` } as CSSProperties}>{slide.tag}</p>
            </div>
          </div>
        </div>
        <div className="framer-191hkq5" data-framer-name="Text Block">
          <div className="framer-1cfszvw" data-framer-name="Title" data-framer-component-type="RichTextContainer" style={{ '--extracted-a0htzi': tokens.white, '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties}>
            <h3 className="framer-text framer-styles-preset-1oke2e1" data-styles-preset="RSOGskbDP" style={{ '--framer-text-color': `var(--extracted-a0htzi, ${tokens.white})` } as CSSProperties}>{slide.title}</h3>
          </div>
          <div className="framer-qeqmug" data-framer-name="Paragraph" data-framer-component-type="RichTextContainer" style={{ '--extracted-r6o4lv': 'var(--token-64ea5169-a638-4017-b73c-ec045eca97b4, rgba(255, 255, 255, 0.8))', '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties}>
            <p className="framer-text framer-styles-preset-1yx751z" data-styles-preset="kfKr753OE" style={{ '--framer-text-color': 'var(--extracted-r6o4lv, var(--token-64ea5169-a638-4017-b73c-ec045eca97b4, rgba(255, 255, 255, 0.8)))' } as CSSProperties}>{slide.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FacultySlideshow({ slides, variant = 'desktop' }: { slides: FacultySlide[]; variant?: Variant }) {
  const v = VARIANT[variant];
  const count = slides.length;
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(count); // start on the second copy
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const items = Array.from({ length: count * COPIES }, (_, i) => slides[i % count]);

  const stepWidth = () => (track.current?.parentElement?.clientWidth ?? 0) + GAP;

  // Position the track for the current index; re-centre silently at the ends.
  useEffect(() => {
    const ul = track.current;
    if (!ul) return;
    const x = -index * stepWidth();
    controls.current?.stop();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.current = animate(ul, { x }, reduced ? { duration: 0 } : SPRING);
    void controls.current.finished.then(() => {
      if (index >= count * (COPIES - 1) || index < count) {
        const home = count + ((index % count) + count) % count;
        setIndex(home);
        animate(ul, { x: -home * stepWidth() }, { duration: 0 });
      }
    });
    return () => controls.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    const onResize = () => { if (track.current) animate(track.current, { x: -index * stepWidth() }, { duration: 0 }); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [index]);

  return (
    <section style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', placeItems: 'center', margin: 0, padding: 0, listStyleType: 'none', userSelect: 'none' }} aria-roledescription="carousel">
      <div style={{ width: '100%', height: '100%', margin: 0, padding: 'inherit', position: 'absolute', inset: 0, overflow: 'visible', borderRadius: 0, userSelect: 'none', perspective: '600px' }}>
        <ul ref={track} style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', placeItems: 'center', margin: 0, padding: 0, listStyleType: 'none', gap: GAP, cursor: 'auto', userSelect: 'none', transform: `translateX(${-count * 100}%)` }}>
          {items.map((slide, i) => {
            const offset = i - index;
            const current = offset === 0;
            const neighbour = Math.abs(offset) === 1;
            return (
              <li key={i} style={{ display: 'contents' }} aria-hidden={!current}>
                <div
                  className={v.slots[i % count] ?? v.slots[0]}
                  style={{ flexShrink: 0, userSelect: 'none', width: '100%', height: '100%', opacity: 1, visibility: current || neighbour ? 'visible' : 'hidden', transform: current ? 'none' : `scale(${SCALE})`, transformOrigin: offset < 0 ? '100% 50% 0' : offset > 0 ? '0% 50% 0' : '50% 50% 0', transition: 'transform 0.4s cubic-bezier(0.44, 0, 0.56, 1)' }}
                >
                  <SlideCard slide={slide} variant={variant} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <fieldset style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', pointerEvents: 'none', userSelect: 'none', top: 0, left: 0, right: 0, bottom: 0, border: 0, padding: 0, margin: 0 }} aria-label="Slideshow pagination controls" className="framer--slideshow-controls">
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 10, opacity: 1, alignItems: 'center', inset: 20, top: v.arrowTop, left: 'unset', right: 0, bottom: 'unset' }}>
          <button type="button" aria-label="Previous" tabIndex={0} onClick={() => setIndex((i) => i - 1)} style={{ border: 'none', display: 'block', placeContent: 'center', placeItems: 'center', overflow: 'hidden', background: 'transparent', cursor: 'pointer', margin: 0, padding: 0, backgroundColor: 'rgba(0, 0, 0, 0)', width: v.arrow, height: v.arrow, borderRadius: v.arrow / 2, pointerEvents: 'auto' }}>
            <img decoding="async" width={v.arrow} height={v.arrow} src="/svg/icons/arrow-left.svg" alt="Back Arrow" />
          </button>
          <button type="button" aria-label="Next" tabIndex={0} onClick={() => setIndex((i) => i + 1)} style={{ border: 'none', display: 'block', placeContent: 'center', placeItems: 'center', overflow: 'hidden', background: 'transparent', cursor: 'pointer', margin: 0, padding: 0, backgroundColor: 'rgba(0, 0, 0, 0)', width: v.arrow, height: v.arrow, borderRadius: v.arrow / 2, pointerEvents: 'auto' }}>
            <img decoding="async" width={v.arrow} height={v.arrow} src="/svg/icons/arrow-right.svg" alt="Next Arrow" />
          </button>
        </div>
      </fieldset>
    </section>
  );
}
