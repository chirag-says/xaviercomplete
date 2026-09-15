'use client';

/**
 * The network: the two places the Association is, and the line between them.
 *
 * SXCCAA has published one chapter, so this is honestly two points and one
 * arc — the seat in Calcutta and the chapter in the west. Nothing is invented
 * to make the picture busier, and because the positions are compositional
 * rather than projected, the section says so in a caption under the drawing.
 * It is editorial data drawing, not a map: no tiles, no pins, no controls.
 *
 * How it is built matters for both accessibility and cost:
 *
 * - The SVG holds only decoration — the arc, the orbits, the halos. It is
 *   `aria-hidden`, and nothing in it can be focused or read.
 * - Each point is a disclosure: a `<button>` that opens the card beside it,
 *   with `aria-expanded` and `aria-controls` saying so. The card is a sibling
 *   rather than a child, because the chapter's card ends in a real link, and a
 *   link inside a button is neither valid nor operable. The seat's card has no
 *   link — Calcutta is where the Association is, not somewhere to go — so its
 *   button opens its card and does nothing else, which is exactly what a
 *   disclosure is for.
 * - An 11px dot is not a target, so the button is a 52px circle centred on the
 *   point. That is the hit area, the hover area and the shape the focus ring
 *   is drawn around.
 * - Placing is the node's own `x`/`y` as a percentage of the viewBox, so the
 *   buttons and the drawing stay registered at every width without a
 *   measurement or a resize listener.
 *
 * The arc draws itself on scroll rather than on a timer: `pathLength="1"`
 * turns the dash offset into the progress number directly, so the line is
 * exactly as far along as the reader is. Scroll back and it un-draws. A short
 * dash travels the same path on a slow loop once it is open, which is the only
 * thing on the page that moves without being asked to.
 *
 * Below 810px the arc is meaningless — a 1000 × 420 box at phone width is a
 * sliver — so the stylesheet drops the positioning to a stacked list against a
 * drawn spine, and both cards start open, since there is no pointer to hover
 * with. That last part is state rather than a stylesheet override, so
 * `aria-expanded` never claims something the reader cannot see.
 *
 * Reduced motion: the arc is fully drawn, the travelling dash and the halos do
 * not run, and following a card's link jumps rather than scrolls.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { crossing } from '@/lib/useScrollLink';
import { useSmoothScrollLink } from '@/lib/useSmoothScrollLink';
import { prefersReducedMotion } from '@/lib/motion';
import { network, type NetworkNode } from '@/data/pages/chapters';

/*
 * A flat box on purpose. At 1000 × 420 the drawing was 545px tall on a desktop
 * for two points and one line, and most of that was black — the composition
 * read as a gap rather than as space. Flattening it to 1000 × 260 keeps the
 * horizontal run, which is the whole idea, and takes a third of the height out.
 */
const BOX = { w: 1000, h: 260 };

/** Mumbai → Calcutta, bowed so the line has a horizon to it. */
const ARC = 'M 196 150 C 390 82, 620 56, 804 78';

/** The rings behind the drawing, widest first. */
const ORBITS = [
  { cx: 804, cy: 78, r: 168 },
  { cx: 804, cy: 78, r: 110 },
  { cx: 196, cy: 150, r: 84 },
];

/** The width at which the drawing is dropped and the nodes stack. */
const STACKED = '(max-width: 809.98px)';

function percent(value: number, of: number) {
  return `${(value / of) * 100}%`;
}

/** The point itself, and the two rings that leave it. Never read aloud. */
function Dot() {
  return (
    <span className="cx-net__dot" aria-hidden="true">
      <span className="cx-net__halo" />
      <span className="cx-net__halo cx-net__halo--late" />
    </span>
  );
}

/** False on the server and on the first client render, so hydration matches. */
function useStacked() {
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(STACKED);
    const sync = () => setStacked(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return stacked;
}

export function ChapterNetwork() {
  const section = useRef<HTMLElement>(null);
  const [live, setLive] = useState<string | null>(null);
  const stacked = useStacked();

  useSmoothScrollLink(
    section,
    (progress) => {
      section.current?.style.setProperty('--draw', String(progress));
    },
    crossing(0.82, 0.3),
    [],
    1,
  );

  /** Follow a card's link smoothly, and let the browser have it otherwise. */
  const follow = useCallback((event: React.MouseEvent<HTMLAnchorElement>, node: NetworkNode) => {
    if (!node.anchor || prefersReducedMotion()) return;
    const target = document.getElementById(node.anchor);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <section className="cx-net" id="network" aria-labelledby="network-heading" ref={section}>
      <div className="ev-shell cx-net__head">
        <p className="cx-eyebrow cx-eyebrow--dark">{network.eyebrow}</p>
        <h2 className="cx-net__title" id="network-heading">
          {network.title.map((line) => (
            <span className="cx-net__titleLine" key={line}>
              {line}
            </span>
          ))}
        </h2>
        <p className="cx-net__lede">{network.lede}</p>
      </div>

      <div className="ev-shell">
        <div className="cx-net__plot">
          <svg
            className="cx-net__draw"
            viewBox={`0 0 ${BOX.w} ${BOX.h}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            focusable="false"
          >
            {ORBITS.map((orbit) => (
              <circle className="cx-net__orbit" key={`${orbit.cx}-${orbit.r}`} cx={orbit.cx} cy={orbit.cy} r={orbit.r} />
            ))}
            {/* the ghost the drawn line is revealed against */}
            <path className="cx-net__track" d={ARC} pathLength={1} />
            <path className="cx-net__line" d={ARC} pathLength={1} />
            <path className="cx-net__pulse" d={ARC} pathLength={1} />
          </svg>

          <ul className="cx-net__nodes">
            {network.nodes.map((node) => {
              const open = stacked || live === node.key;
              const cardId = `net-card-${node.key}`;
              return (
                <li
                  className="cx-net__node"
                  key={node.key}
                  data-seat={node.seat ? '' : undefined}
                  data-open={open ? '' : undefined}
                  data-dim={live !== null && live !== node.key ? '' : undefined}
                  style={{ left: percent(node.x, BOX.w), top: percent(node.y, BOX.h) }}
                  onMouseEnter={() => setLive(node.key)}
                  onMouseLeave={() => setLive((v) => (v === node.key ? null : v))}
                  /* closes only once focus has left the node altogether, so
                     tabbing from the button to the link inside the card it
                     opened does not shut the card on the way */
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setLive((v) => (v === node.key ? null : v));
                    }
                  }}
                >
                  {/* Stacked, every card is already open, so a button here
                      would be a control that cannot do anything and an
                      `aria-expanded` that is permanently true. The point goes
                      back to being a mark on the spine, and the link inside
                      the card is the only thing to operate. */}
                  {stacked ? (
                    <span className="cx-net__pin" aria-hidden="true">
                      <Dot />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="cx-net__pin"
                      aria-expanded={open}
                      aria-controls={cardId}
                      aria-label={`${node.city} — ${node.role}`}
                      onClick={() => setLive((v) => (v === node.key ? null : node.key))}
                      onFocus={() => setLive(node.key)}
                    >
                      <Dot />
                    </button>
                  )}

                  <div className="cx-net__card" id={cardId}>
                    <p className="cx-net__city">{node.city}</p>
                    <p className="cx-net__role">{node.role}</p>
                    <div className="cx-net__more">
                      <p className="cx-net__detail">{node.detail}</p>
                      <p className="cx-net__meta">{node.meta}</p>
                      {node.anchor ? (
                        <a
                          className="cx-net__go"
                          href={`#${node.anchor}`}
                          onClick={(event) => follow(event, node)}
                        >
                          {node.action} <span aria-hidden="true">→</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="cx-net__caption">
          <span className="cx-net__hint">{network.hint}</span>
          <span className="ev-rule" aria-hidden="true" />
          {network.caption}
        </p>
      </div>
    </section>
  );
}
