'use client';

/**
 * The home page's reveal preloader: the College's crest, and nothing else.
 *
 * The template's version filled a bar under the wordmark, so what a visitor
 * read while waiting was the words "St. Xavier's College" set in type. A ring
 * drawn around the crest replaced it for a while, and that went too: a mark
 * this detailed does not need a second thing revolving around it.
 *
 * So there are two movements and a beat between them:
 *
 *   0.05s  the crest rises from 0.9 and resolves out of an 8px blur. Coming
 *          into focus is what a mark being struck looks like; a plain fade is
 *          what an image loading looks like.
 *   0.75s  it holds, in focus and still. The hold is the point — it is what
 *          separates a splash screen from a flicker.
 *   1.10s  the panel leaves upward on the export's easing, the crest running a
 *          little ahead of it so the two read as depth rather than one slab.
 *
 * The panel is `position: absolute` over the first viewport with pointer
 * events off, so the page underneath is interactive throughout and the hero's
 * own entrance plays in parallel, as it does on the original.
 *
 * Reduced motion: the crest is simply there, and the panel leaves without
 * travelling.
 */

import { useEffect, useRef } from 'react';
import { animate } from 'motion';

/** The crest's entrance: Framer's default spring, as the hero titles use. */
const RISE = { type: 'spring' as const, stiffness: 400, damping: 100, mass: 1 };
/** The crest coming into focus, a little slower than it rises. */
const FOCUS = { type: 'tween' as const, duration: 0.7, ease: [0.32, 0, 0.24, 1] as [number, number, number, number] };
/** The panel's exit: Framer's `Lt` transition on the original component. */
const LEAVE = { type: 'tween' as const, duration: 1, ease: [0.96, -0.02, 0.38, 1.01] as [number, number, number, number] };

const AT = { rise: 50, leave: 1100 } as const;

export function Preloader() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const panel = container.querySelector<HTMLElement>('[data-preloader-panel]');
    const mark = container.querySelector<HTMLElement>('[data-preloader-mark]');
    if (!panel || !mark) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const controls: { stop(): void }[] = [];
    const timers: number[] = [];
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));

    if (reduced) {
      mark.style.opacity = '1';
      mark.style.transform = 'none';
      mark.style.filter = 'none';
      at(AT.leave, () => { panel.style.opacity = '0'; });
    } else {
      at(AT.rise, () => {
        try {
          controls.push(animate(mark, { opacity: 1, scale: 1, y: 0 }, RISE));
          controls.push(animate(mark, { filter: ['blur(8px)', 'blur(0px)'] }, FOCUS));
        } catch {
          mark.style.opacity = '1';
          mark.style.transform = 'none';
          mark.style.filter = 'none';
        }
      });

      at(AT.leave, () => {
        try {
          controls.push(animate(mark, { y: -64, opacity: 0 }, { ...LEAVE, duration: 0.74 }));
          controls.push(animate(panel, { y: -(window.innerHeight + 80) }, LEAVE));
        } catch {
          panel.style.display = 'none';
        }
      });
    }

    // Whatever happened above, the panel is out of the way by now. A splash
    // screen that fails to leave takes the whole page with it, and no animation
    // is worth that risk.
    at(AT.leave + 1400, () => { panel.style.display = 'none'; });

    return () => {
      for (const t of timers) window.clearTimeout(t);
      for (const c of controls) c.stop();
    };
  }, []);

  return (
    <div className="framer-1i71b0h-container site-preloader" ref={root} aria-hidden="true">
      {/* nothing below moves without script, and a panel that cannot leave
          would hold the page shut */}
      <noscript>
        <style>{`.site-preloader{display:none}`}</style>
      </noscript>
      <div className="site-preloader__panel" data-preloader-panel="">
        <div className="site-preloader__mark" data-preloader-mark="">
          <img src="/images/brand/crest-420.png" width={352} height={420} alt="" decoding="async" />
        </div>
      </div>
    </div>
  );
}
