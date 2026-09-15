'use client';

/**
 * A counter with an underline that fills to a set width (`framer-tesmQ`).
 * Framer switches the block to its "animated" variant once it is in view;
 * the underline grows over 1.5s with the same ease the counter uses.
 */

import { useRef, type CSSProperties } from 'react';
import { NumberCounter } from '@/components/ui/NumberCounter';
import { useInView } from '@/lib/useInView';
import { VARIANT_EASING } from '@/lib/motion';
import { tokens } from '@/lib/tokens';
import type { StatLine as Stat } from '@/data/pages/about';

const LINE_CLASSES = [
  { track: 'framer-10rqg8c', fill: 'framer-1pxuvxl', name: 'Line 1' },
  { track: 'framer-1odloco', fill: 'framer-ryb8er', name: 'Line 2' },
];
const VARIANT = {
  desktop: { cls: 'framer-v-878slr', name: 'Desktop Initial', fontSize: '80px', lineHeight: '1.125em' },
  tablet: { cls: 'framer-v-2fnv4c', name: 'Tablet Initial', fontSize: '44px', lineHeight: '1.1em' },
} as const;
const RADIUS = { borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px', borderTopLeftRadius: '10px', borderTopRightRadius: '10px' };
const DURATION = '1.5s';

export function StatLine({ stat, index, variant, containerClass }: { stat: Stat; index: number; variant: keyof typeof VARIANT; containerClass: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useInView(ref);
  const v = VARIANT[variant];
  const line = LINE_CLASSES[index] ?? LINE_CLASSES[LINE_CLASSES.length - 1];
  return (
    <div className={containerClass}>
      <div ref={ref} className={`framer-tesmQ framer-PG8vB framer-878slr ${v.cls}`} data-framer-name={v.name} style={{ width: '100%' }}>
        <div className="framer-dxvvy4" data-framer-name="Text Block">
          <div className="framer-1qaot30-container" data-code-component-plugin-id="84d4c1" data-framer-name=" Number Counter">
            <NumberCounter
              end={stat.value}
              suffix={stat.suffix}
              display={stat.display}
              group={stat.group}
              style={{ color: tokens.white, fontFamily: '"Instrument Sans", "Instrument Sans Placeholder", sans-serif', fontSize: v.fontSize, fontStyle: 'normal', fontWeight: '600', letterSpacing: '0em', lineHeight: v.lineHeight }}
            />
          </div>
          <div
            className="framer-r0d770"
            data-framer-name="Text"
            data-framer-component-type="RichTextContainer"
            style={{ '--extracted-r6o4lv': tokens.white, '--framer-link-text-color': 'rgb(0, 153, 255)', '--framer-link-text-decoration': 'underline', transform: 'none' } as CSSProperties}
          >
            <p className="framer-text framer-styles-preset-1s2szaz" data-styles-preset="iF_e_kz5u" style={{ '--framer-text-color': `var(--extracted-r6o4lv, ${tokens.white})` } as CSSProperties}>
              {stat.text}
            </p>
          </div>
        </div>
        <div className={line.track} data-framer-name={line.name} style={{ backgroundColor: 'var(--token-7d23561c-8e41-40bd-aa1c-c6efa74680d3, rgba(255, 255, 255, 0.3))', ...RADIUS }}>
          <div
            className={line.fill}
            data-framer-name="Line"
            style={{
              backgroundColor: tokens.white,
              ...RADIUS,
              width: active ? stat.lineWidth : '0%',
              opacity: active ? 1 : 0,
              transition: active ? `width ${DURATION} ${VARIANT_EASING}, opacity ${DURATION} ${VARIANT_EASING}` : 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
