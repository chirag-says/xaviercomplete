import type { CSSProperties } from 'react';
import { NumberCounter } from '@/components/ui/NumberCounter';
import { tokens } from '@/lib/tokens';
import type { Breakpoint } from '@/lib/breakpoints';
import type { FactCard as Fact } from '@/data/pages/about';

/** One of the three fact cards on the about page (`framer-4Hrmw`). */

const VARIANT: Record<Breakpoint, { cls: string; name: string; radius: string; fontSize: string; fill: boolean }> = {
  desktop: { cls: 'framer-v-1pecqhf', name: 'Desktop', radius: '15px', fontSize: '64px', fill: false },
  tablet: { cls: 'framer-v-1c4t1nk', name: 'Tablet', radius: '12px', fontSize: '46px', fill: true },
  phone: { cls: 'framer-v-u9o5gh', name: 'Phone', radius: '12px', fontSize: '36px', fill: true },
};

const TEXT_STYLE = { '--framer-link-text-color': 'rgb(0, 153, 255)', '--framer-link-text-decoration': 'underline', transform: 'none' } as CSSProperties;

export function FactCard({ fact, breakpoint, containerClass }: { fact: Fact; breakpoint: Breakpoint; containerClass: string }) {
  const v = VARIANT[breakpoint];
  return (
    <div className={containerClass} style={{ willChange: 'transform', opacity: 0, transform: 'translateY(60px)' }}>
      <div
        className={`framer-4Hrmw framer-CU54s framer-PG8vB framer-1pecqhf ${v.cls}`}
        data-framer-name={v.name}
        style={{
          backgroundColor: tokens.grey,
          ...(v.fill ? { height: '100%' } : {}),
          width: '100%',
          borderBottomLeftRadius: v.radius,
          borderBottomRightRadius: v.radius,
          borderTopLeftRadius: v.radius,
          borderTopRightRadius: v.radius,
        }}
      >
        <div className="framer-15ag9uq-container" data-code-component-plugin-id="84d4c1" data-framer-name=" Number Counter">
          <NumberCounter
            end={fact.value}
            suffix={fact.suffix}
            display={fact.display}
            group={fact.group}
            style={{ color: tokens.ink, fontFamily: '"Montserrat", "Montserrat Placeholder", sans-serif', fontSize: v.fontSize, fontStyle: 'normal', fontWeight: '600', letterSpacing: '0em', lineHeight: '1.15625em' }}
          />
        </div>
        <div className="framer-w56w4k" data-framer-name="Text Block">
          <div className="framer-416uiu" data-framer-name="Title" data-framer-component-type="RichTextContainer" style={TEXT_STYLE}>
            <div className="framer-text framer-styles-preset-1b037vn" data-styles-preset="kas5vqx3I">
              {fact.title}
            </div>
          </div>
          <div className="framer-17uv26w" data-framer-name="Description" data-framer-component-type="RichTextContainer" style={TEXT_STYLE}>
            <p className="framer-text framer-styles-preset-1s2szaz" data-styles-preset="iF_e_kz5u">
              {fact.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
