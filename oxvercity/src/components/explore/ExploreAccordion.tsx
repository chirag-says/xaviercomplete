'use client';

/**
 * The "Explore the Xaverian network" accordion (`framer-KKWPz` wrapper,
 * `framer-49uvd` items) used on the home page and on /explore. Exactly one
 * item is open, as on the original, whose wrapper has one "Step" variant per
 * entry.
 *
 * Opening an item switches it to Framer's open variant; the text block and
 * the image wrap grow from their measured heights over 0.5s (a FLIP with the
 * Web Animations API) while the image scales up from the bottom edge and the
 * plus icon turns into a cross. `site.css` carries the colour transitions.
 */

import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { imageSrcSet } from '@/lib/images';
import { animateHeight, prefersReducedMotion } from '@/lib/motion';
import { tokens } from '@/lib/tokens';
import type { Breakpoint } from '@/lib/breakpoints';
import type { ExploreItem } from '@/data/explore';

const ITEM_CONTAINERS = ['framer-3y0d32-container', 'framer-rbh95m-container', 'framer-1kb7ve3-container', 'framer-1gswekf-container', 'framer-1pccm2e-container', 'framer-tbsgjl-container', 'framer-1dx9ps-container', 'framer-pz4vch-container'];
const DURATION = 500;
const IMAGE_SIZES =
  '(min-width: 1200px) min((min(min(100vw, 1800px) - 40px, 1296px) - 3px) * 0.2567, 308px), (max-width: 809.98px) max(min((min(min(100vw, 620px) - 40px, 1296px) - 3px) * 0.2567, 308px), 250px), (min-width: 810px) and (max-width: 1199.98px) min((min(min(100vw, 990px) - 40px, 1296px) - 3px) * 0.2855, 308px)';

interface VariantSpec {
  wrapper: string;
  wrapperName: string;
  open: string;
  openName: string;
  closed: string;
  closedName: string;
  button: 'default' | 'phone';
  /** On phone the plus rotates inside a still circle; elsewhere the circle itself turns. */
  plusRotates: boolean;
}

const VARIANT: Record<Breakpoint, VariantSpec> = {
  desktop: { wrapper: 'framer-v-2vyiyj', wrapperName: 'Desktop - Step 01', open: 'framer-v-tvy2w6', openName: 'Desktop Open', closed: 'framer-v-tqlfqn', closedName: 'Desktop Closed', button: 'default', plusRotates: false },
  tablet: { wrapper: 'framer-v-17a6wjd', wrapperName: 'Tablet - Step 01', open: 'framer-v-1fnb2wi', openName: 'Tablet - Open', closed: 'framer-v-asw8py', closedName: 'Tablet - Close', button: 'phone', plusRotates: false },
  phone: { wrapper: 'framer-v-dl6j8w', wrapperName: 'Phone - Step 01', open: 'framer-v-17kxg94', openName: 'Phone - Open', closed: 'framer-v-xa7020', closedName: 'Phone - Close', button: 'phone', plusRotates: true },
};

const RICH = { '--framer-link-text-color': 'rgb(0, 153, 255)', '--framer-link-text-decoration': 'underline', '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties;
const RADIUS_10 = { borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px', borderTopLeftRadius: '10px', borderTopRightRadius: '10px' };
const RADIUS_24 = { borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px' };
const FILL: CSSProperties = { position: 'absolute', borderRadius: 'inherit', top: 0, right: 0, bottom: 0, left: 0 };
const IMG: CSSProperties = { display: 'block', width: '100%', height: '100%', borderRadius: 'inherit', objectPosition: 'center', objectFit: 'cover' };

function Item({ item, index, open, spec, detailsLabel, onOpen }: { item: ExploreItem; index: number; open: boolean; spec: VariantSpec; detailsLabel: string; onOpen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<{ text: number; image: number } | null>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    const text = root?.querySelector<HTMLElement>('.framer-1jm6qrw');
    const image = root?.querySelector<HTMLElement>('.framer-1571v0n');
    if (!text || !image) return;
    const next = { text: text.offsetHeight, image: image.offsetHeight };
    if (last.current && !prefersReducedMotion()) {
      animateHeight(text, last.current.text, next.text, DURATION);
      animateHeight(image, last.current.image, next.image, DURATION);
    }
    last.current = next;
  }, [open]);

  const circleTurns = open && !spec.plusRotates;
  const lineColor = open ? tokens.white : tokens.ink;
  const iconStyle = {
    '--border-bottom-width': '1px',
    '--border-color': circleTurns ? 'rgba(18, 18, 18, 0)' : tokens.ink,
    '--border-left-width': '1px',
    '--border-right-width': '1px',
    '--border-style': 'solid',
    '--border-top-width': '1px',
    backgroundColor: open ? tokens.ink : 'rgba(17, 17, 17, 0)',
    ...RADIUS_24,
    transform: circleTurns ? 'rotate(45deg)' : 'none',
  } as CSSProperties;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div id={item.id} className={ITEM_CONTAINERS[index] ?? ITEM_CONTAINERS[ITEM_CONTAINERS.length - 1]} style={{ willChange: 'transform', opacity: 0, transform: 'translateY(40px)' }}>
      <div
        ref={ref}
        className={`framer-49uvd framer-beQND framer-RqKzS framer-tqlfqn ${open ? spec.open : spec.closed}`}
        data-framer-name={open ? spec.openName : spec.closedName}
        data-highlight="true"
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={onKeyDown}
        style={{ width: '100%' }}
      >
        <div className="framer-3187wu" data-framer-name="Line" style={{ backgroundColor: 'rgba(17, 17, 17, 0.15)' }} />
        <div className="framer-xrwonk" data-framer-name="Accordion Wrapper">
          <div className="framer-1c0jl16" data-framer-name="Content Wrapper">
            <div className="framer-at71md" data-framer-name="Title Block">
              <div className="framer-49ib86" data-framer-name="Title" data-framer-component-type="RichTextContainer" style={RICH}>
                <h3 className="framer-text framer-styles-preset-1h8x64o" data-styles-preset="GdY3eNkNq">
                  {item.title}
                </h3>
              </div>
              <div className="framer-1jm6qrw" data-framer-name="Text Block" aria-hidden={!open}>
                <div className="framer-17emc14" data-framer-name="Text" data-framer-component-type="RichTextContainer" style={RICH}>
                  <p className="framer-text framer-styles-preset-1yx751z" data-styles-preset="kfKr753OE">
                    {item.description}
                  </p>
                </div>
                <Button label={detailsLabel} href={item.href} variant={spec.button} containerClass="framer-18hrayh-container" style={{ height: '100%' }} />
              </div>
            </div>
            <div className="framer-1571v0n" data-framer-name="Image Wrap">
              <div className="framer-kstmv" data-framer-name="Image" style={{ filter: 'blur(0px)', WebkitFilter: 'blur(0px)', ...RADIUS_10, transform: open ? 'none' : 'translate(-50%, -50%) scale(0)' }}>
                <div style={FILL} data-framer-background-image-wrapper="true">
                  <img decoding="async" width={item.image.width} height={item.image.height} sizes={IMAGE_SIZES} srcSet={imageSrcSet(item.image)} src={item.image.src} alt={item.image.alt} style={IMG} />
                </div>
              </div>
            </div>
          </div>
          <div className="framer-1bwzyd0" data-border="true" data-framer-name="Accordion Icon" style={iconStyle}>
            <div className="framer-pwy9x1" data-framer-name="Plus" style={{ transform: open && spec.plusRotates ? 'rotate(45deg)' : 'none' }}>
              <div className="framer-z8m3az" data-framer-name="Line" style={{ backgroundColor: lineColor, ...RADIUS_10 }} />
              <div className="framer-giubg6" data-framer-name="Line" style={{ backgroundColor: lineColor, ...RADIUS_10 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExploreAccordion({ items, breakpoint, containerClass, detailsLabel = 'Explore' }: { items: ExploreItem[]; breakpoint: Breakpoint; containerClass: string; detailsLabel?: string }) {
  const [open, setOpen] = useState(0);
  const spec = VARIANT[breakpoint];
  return (
    <div className={containerClass}>
      <div className={`framer-KKWPz framer-2vyiyj ${spec.wrapper}`} data-framer-name={spec.wrapperName} style={{ width: '100%' }}>
        <div className="framer-1m349ej" data-framer-name="Program Stack">
          {items.map((item, i) => (
            <Item key={item.id} item={item} index={i} open={i === open} spec={spec} detailsLabel={detailsLabel} onOpen={() => setOpen(i)} />
          ))}
        </div>
        <div className="framer-191fulo-container">
          <div />
        </div>
      </div>
    </div>
  );
}
