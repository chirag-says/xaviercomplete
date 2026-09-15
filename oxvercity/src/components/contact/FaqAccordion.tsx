'use client';

/**
 * The FAQ accordion on the contact page (`framer-n5zUc` wrapper, `framer-mA0WG`
 * items with a hairline between each). The first item starts open; any item
 * can be toggled. Opening switches the item to Framer's open variant, which
 * adds the answer; the item's height then grows from its measured value over
 * 0.4s while the plus turns into a cross (`site.css` animates the icon).
 */

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { animateHeight, prefersReducedMotion } from '@/lib/motion';
import { tokens } from '@/lib/tokens';
import type { Breakpoint } from '@/lib/breakpoints';
import type { FaqItem } from '@/data/pages/contact';

const ITEM_CONTAINERS = ['framer-18d1vlg-container', 'framer-1s604ar-container', 'framer-cmpf1g-container', 'framer-ypp3ea-container', 'framer-1kr2f3i-container', 'framer-1j6sz9e-container'];
const LINES = ['framer-ql88yr', 'framer-ymchr3', 'framer-on8kep', 'framer-1bdck2s', 'framer-wpk82', 'framer-16033z5'];
const DURATION = 400;

const VARIANT: Record<Breakpoint, { gap: string; itemGap: string; align: string; maxWidth: boolean }> = {
  desktop: { gap: '30px', itemGap: '20px', align: 'center', maxWidth: true },
  tablet: { gap: '24px', itemGap: '16px', align: 'flex-start', maxWidth: true },
  phone: { gap: '20px', itemGap: '14px', align: 'center', maxWidth: false },
};

const RICH = { '--framer-link-text-color': 'rgb(0, 153, 255)', '--framer-link-text-decoration': 'underline', '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties;
const REVEAL: CSSProperties = { willChange: 'transform', opacity: 0, transform: 'translateY(40px)' };
const RADIUS_24 = { borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px' };

function Item({ item, index, open, itemGap, align, onToggle }: { item: FaqItem; index: number; open: boolean; itemGap: string; align: string; onToggle: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<number | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = root.offsetHeight;
    if (last.current !== null && !prefersReducedMotion()) animateHeight(root, last.current, next, DURATION);
    last.current = next;
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div className={ITEM_CONTAINERS[index] ?? ITEM_CONTAINERS[ITEM_CONTAINERS.length - 1]} style={REVEAL}>
      <div
        ref={ref}
        className={`framer-mA0WG framer-CU54s framer-PG8vB framer-5ca1t2 ${open ? 'framer-v-5ca1t2' : 'framer-v-sx1a2a'}`}
        data-framer-name={open ? 'Accordion Open' : 'Accordion  Close'}
        data-highlight="true"
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        style={{ '--q053k3': itemGap, width: '100%' } as CSSProperties}
      >
        <div className="framer-1vxnjwz" data-framer-name="Question & Icon" style={{ '--1le75ge': align } as CSSProperties}>
          <div className="framer-pmki4e" data-framer-name="Question" data-framer-component-type="RichTextContainer" style={RICH}>
            <h3 className="framer-text framer-styles-preset-1b037vn" data-styles-preset="kas5vqx3I">
              {item.question}
            </h3>
          </div>
          <div className="framer-ew4fl7" data-framer-name="Accordion Icon" style={{ ...RADIUS_24, transform: open ? 'rotate(45deg)' : 'none' }}>
            <div className="framer-fq707p" data-framer-name="Plus">
              <div className="framer-ij6x5e" data-framer-name="Line" style={{ backgroundColor: tokens.ink }} />
              <div className="framer-nbjx4f" data-framer-name="Line" style={{ backgroundColor: tokens.ink }} />
            </div>
          </div>
        </div>
        {open && (
          <div className="framer-2b11o3" data-framer-name="Answer" data-framer-component-type="RichTextContainer" style={RICH}>
            <p className="framer-text framer-styles-preset-1s2szaz" data-styles-preset="iF_e_kz5u">
              {item.answer}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function FaqAccordion({ items, breakpoint }: { items: FaqItem[]; breakpoint: Breakpoint }) {
  const [open, setOpen] = useState<number | null>(0);
  const v = VARIANT[breakpoint];
  return (
    <div className="framer-j8p5yo-container">
      <div className="framer-n5zUc framer-ktvrew framer-v-ktvrew" data-framer-name="Default Step 01" style={{ '--1duqvms': v.gap, ...(v.maxWidth ? { maxWidth: '100%' } : {}), width: '100%' } as CSSProperties}>
        {items.map((item, i) => (
          <div key={item.question} style={{ display: 'contents' }}>
            <Item item={item} index={i} open={open === i} itemGap={v.itemGap} align={v.align} onToggle={() => setOpen(open === i ? null : i)} />
            <div
              className={LINES[i] ?? LINES[LINES.length - 1]}
              data-framer-name="Line"
              style={{ backgroundColor: i === 0 ? 'var(--token-6c56257a-38b4-486e-b804-398ec4a0a7d8, rgb(209, 209, 209))' : 'rgba(18, 18, 18, 0.25)', ...REVEAL }}
            />
          </div>
        ))}
        <div className="framer-1oeix06-container">
          <div />
        </div>
      </div>
    </div>
  );
}
