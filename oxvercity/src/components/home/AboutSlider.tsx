'use client';

/**
 * The About section's three-panel composition, driven by scroll position.
 *
 * The geometry is the Framer export's own (`.framer-LyUVn` in framer.css) and
 * is left untouched: a container holding three absolutely positioned panels —
 * a 25% side panel pinned left, a 45% centre panel at `left: 50%` pulled back
 * by half its width, a 25% side panel pinned right. At rest that lays out as
 * 25 + 24px + 45 + 24px + 25, filling the container exactly.
 *
 * The export also carries the three states the original stepped through, as
 * variant classes that move the side panels by `left`:
 *
 *     .framer-v-o4ot4b   left panel at 40%, right at 60%   (start)
 *     .framer-v-3r074k   34% / 66%
 *     .framer-v-cg35jq   24% / 76%
 *     (base)             left: 0 / right: 0                (rest)
 *
 * Each of those is a side panel centred on that percentage, so its leading
 * edge sits at `p - 12.5%` of the container: 27.5%, 21.5%, 11.5% and 0%. The
 * first of those is exactly where the centre panel's own edge is, so at the
 * start each side panel is tucked completely behind the centre — which is a
 * layer above it — and the four states are 100%, 78.2%, 41.8% and 0% of that
 * one distance. Stating them as fractions rather than as a percentage of the
 * panel keeps them true at any proportions: the distance itself is measured
 * off the laid-out boxes, so the phone's wider centre panel needs no separate
 * table. It is animated as a transform because `left` is not free to animate.
 *
 * The sides also hold at 0.4 opacity until the last step, which is what makes
 * them read as one composition emerging rather than three cards arriving.
 *
 * Scroll drives it directly. The block is taller than the panel by the three
 * spacers the export already carried (3 x 200px plus the column's 40px gaps =
 * 720px on desktop), the panel is sticky inside it, and progress is simply how
 * far through that travel the page has scrolled. There is no timer, no spring
 * and no easing between the reading and the transform: stop scrolling and it
 * stops, scroll back and it runs backwards. The keyframes are spaced to leave
 * a short hold at each end so the closed and open compositions both get a beat
 * of stillness.
 *
 * Reduced motion renders the rest state and never listens for scroll.
 */

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import { tokens } from '@/lib/tokens';

/** Scroll progress at which each keyframe lands, and the values there. */
const OFFSET_STOPS = [0, 0.08, 0.36, 0.64, 0.92, 1] as const;
/** Side panel offset, as a fraction of the distance it has to travel. */
const OFFSET_VALUES = [1, 1, 0.781818, 0.418182, 0, 0] as const;
const FADE_STOPS = [0, 0.64, 0.92, 1] as const;
const FADE_VALUES = [0.4, 0.4, 1, 1] as const;

const RADIUS = {
  borderTopLeftRadius: '10px',
  borderTopRightRadius: '10px',
  borderBottomLeftRadius: '10px',
  borderBottomRightRadius: '10px',
} as const;

const FILL = {
  position: 'absolute',
  borderRadius: 'inherit',
  inset: 0,
} as const satisfies React.CSSProperties;

/** The centre panel is a photograph and fills its frame; the two marks do not. */
const COVER = { display: 'block', width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' } as const satisfies React.CSSProperties;
const CONTAIN = { display: 'block', width: '100%', height: '100%', objectFit: 'contain' } as const satisfies React.CSSProperties;

/** Piecewise-linear read of a keyframe table. */
function keyframe(stops: readonly number[], values: readonly number[], t: number): number {
  if (t <= stops[0]) return values[0];
  for (let i = 1; i < stops.length; i += 1) {
    if (t > stops[i]) continue;
    const span = stops[i] - stops[i - 1];
    const f = span === 0 ? 1 : (t - stops[i - 1]) / span;
    return values[i - 1] + (values[i] - values[i - 1]) * f;
  }
  return values[values.length - 1];
}

export function AboutSlider() {
  const block = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const centre = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const blockEl = block.current;
    const pinEl = pin.current;
    const leftEl = left.current;
    const centreEl = centre.current;
    const rightEl = right.current;
    if (!blockEl || !pinEl || !leftEl || !centreEl || !rightEl) return;

    // How far each side panel travels: from its leading edge sitting on the
    // centre panel's to its own resting place. Measured off the boxes with the
    // transforms cleared, so it holds whatever the breakpoint makes the panels
    // and does not assume how any of them are positioned.
    let leftSpan = 0;
    let rightSpan = 0;
    // The sticky panel is held `top` from the viewport top and travels the
    // difference between the block and itself, so progress starts when the
    // block's top reaches that line and ends when the block runs out.
    let start = 0;
    let travel = 1;
    const measure = () => {
      const held = [leftEl.style.transform, rightEl.style.transform];
      leftEl.style.transform = 'none';
      rightEl.style.transform = 'none';
      const centreBox = centreEl.getBoundingClientRect();
      leftSpan = centreBox.left - leftEl.getBoundingClientRect().left;
      rightSpan = rightEl.getBoundingClientRect().right - centreBox.right;
      [leftEl.style.transform, rightEl.style.transform] = held;

      const top = parseFloat(getComputedStyle(pinEl).top) || 0;
      start = blockEl.getBoundingClientRect().top + window.scrollY - top;
      travel = Math.max(blockEl.offsetHeight - pinEl.offsetHeight, 1);
    };

    const apply = (progress: number) => {
      const offset = keyframe(OFFSET_STOPS, OFFSET_VALUES, progress);
      const fade = String(keyframe(FADE_STOPS, FADE_VALUES, progress));
      leftEl.style.transform = `translateX(${leftSpan * offset}px)`;
      rightEl.style.transform = `translateX(${-rightSpan * offset}px)`;
      leftEl.style.opacity = fade;
      rightEl.style.opacity = fade;
    };

    if (prefersReducedMotion()) {
      measure();
      apply(1);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      apply(Math.min(Math.max((window.scrollY - start) / travel, 0), 1));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      update();
    };

    measure();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    // The observer covers a width change; the listener covers a height-only one,
    // which moves the sticky offset without resizing the block.
    window.addEventListener('resize', onResize);
    const observer = new ResizeObserver(onResize);
    observer.observe(blockEl);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={block} className="framer-1o2wl6s about-slider" data-framer-name="Image Slider Block">
      <div
        ref={pin}
        className="framer-foys6q-container"
        style={{ willChange: 'transform', opacity: '0', transform: 'translateY(40px)' } as React.CSSProperties}
      >
        <div className="framer-LyUVn framer-1cj6bs1" data-framer-name="Default" style={{ height: '100%', width: '100%' }}>
          <div
            ref={left}
            className="framer-otr7f8"
            data-framer-name="Crest"
            style={{ ...RADIUS, opacity: 0.4, transform: 'translateX(110%)', backgroundColor: tokens.ink, willChange: 'transform, opacity' } as React.CSSProperties}
          >
            <div style={{ ...FILL, padding: '12%' }} data-framer-background-image-wrapper="true">
              <img
                decoding="async"
                width={1144}
                height={1364}
                sizes="(max-width: 809.98px) 20vw, min(25vw, 330px)"
                srcSet="/images/home/about-crest-512.png 512w, /images/home/about-crest-1024.png 1024w, /images/home/about-crest.png 1144w"
                src="/images/home/about-crest-512.png"
                alt="The crest of St. Xaviers College (Calcutta)"
                style={CONTAIN}
              />
            </div>
          </div>

          <div
            ref={centre}
            className="framer-1ejz204"
            data-framer-name="Campus"
            style={{ ...RADIUS, transform: 'translateX(-50%)' } as React.CSSProperties}
          >
            <div style={FILL} data-framer-background-image-wrapper="true">
              <img
                decoding="async"
                width={1447}
                height={1087}
                sizes="(max-width: 809.98px) 56vw, min(45vw, 588px)"
                /* the file is 1447px wide, so the srcset stops there: a 2048
                   variant would only be this one upscaled */
                srcSet="/images/home/about-slide-1-512.jpg 512w, /images/home/about-slide-1-1024.jpg 1024w, /images/home/about-slide-1.jpg 1447w"
                src="/images/home/about-slide-1-1024.jpg"
                alt="A Xaverian raising her diploma on the College grounds on graduation day"
                style={{ ...COVER, objectPosition: 'center' }}
              />
            </div>
          </div>

          <div
            ref={right}
            className="framer-1gtwo5i"
            data-framer-name="EMRC"
            style={{ ...RADIUS, opacity: 0.4, transform: 'translateX(-110%)', backgroundColor: 'rgb(147, 240, 239)', willChange: 'transform, opacity' } as React.CSSProperties}
          >
            <div style={{ ...FILL, padding: '7%' }} data-framer-background-image-wrapper="true">
              <img
                decoding="async"
                width={1733}
                height={849}
                sizes="(max-width: 809.98px) 20vw, min(25vw, 330px)"
                srcSet="/images/home/about-emrc-512.png 512w, /images/home/about-emrc-1024.png 1024w, /images/home/about-emrc.png 1733w"
                src="/images/home/about-emrc-512.png"
                alt="EMRC Kolkata, a UGC Media Centre, with the College crest"
                style={CONTAIN}
              />
            </div>
          </div>
        </div>
      </div>

      {/* The export's own spacers: what the sticky panel travels through. */}
      <div className="framer-14udjcw" data-framer-name="Trigger 01" id="trigger-01" aria-hidden />
      <div className="framer-13lzhb6" data-framer-name="Trigger 02" id="trigger-02" aria-hidden />
      <div className="framer-101td2o" data-framer-name="Trigger 03" id="trigger-03" aria-hidden />
    </div>
  );
}
