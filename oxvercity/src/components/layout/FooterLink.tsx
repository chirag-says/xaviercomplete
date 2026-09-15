import type { CSSProperties } from 'react';
import { tokens } from '@/lib/tokens';
import type { NavLink } from '@/data/site';

/**
 * A footer list link (`framer-ba157`). On desktop the label slides up on
 * hover to reveal a bolder twin (`site.css`); tablet and phone use the
 * "Small" variant without it.
 */

const TEXT = { '--extracted-r6o4lv': tokens.ink, transform: 'none' } as CSSProperties;
const P = { '--framer-text-color': `var(--extracted-r6o4lv, ${tokens.ink})` } as CSSProperties;

export function FooterLink({ link, variant, containerClass }: { link: NavLink; variant: 'default' | 'small'; containerClass: string }) {
  const small = variant === 'small';
  return (
    <div className={containerClass}>
      <a className={`framer-ba157 framer-FuTU5 framer-3M3h1 framer-2tb5rq ${small ? 'framer-v-cdlut6' : 'framer-v-2tb5rq'} framer-1rvw30y`} data-framer-name={small ? 'Small' : 'Default'} href={link.href}>
        <div className="framer-1w2poyh" data-framer-name="Defaut Text" data-framer-component-type="RichTextContainer" style={TEXT}>
          <p className="framer-text framer-styles-preset-1x4tk8l" data-styles-preset="pDck0CifI" style={P}>
            {link.label}
          </p>
        </div>
        {!small && (
          <div className="framer-77rbd" data-framer-name="Hover Text" data-framer-component-type="RichTextContainer" style={TEXT}>
            <p className="framer-text framer-styles-preset-k6q7pz" data-styles-preset="PpxHxIb0y" style={P}>
              {link.label}
            </p>
          </div>
        )}
      </a>
    </div>
  );
}
