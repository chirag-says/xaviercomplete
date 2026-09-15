import type { CSSProperties } from 'react';
import { imageSrcSet } from '@/lib/images';
import { tokens } from '@/lib/tokens';
import type { NewsCard as Card } from '@/data/pages/about';

/**
 * A "Latest news" card (`framer-jo2CN`): category pill, image, date and
 * title. The image zooms and tilts slightly on hover (`site.css`).
 */

const VARIANT = {
  desktop: { cls: 'framer-v-oqfc1u', name: 'Default', radius: '15px' },
  phone: { cls: 'framer-v-1tg11r', name: 'Phone', radius: '10px' },
} as const;
const SIZES =
  '(min-width: 1200px) max(max((min(min(100vw, 1800px) - 40px, 1296px) - 48px) / 3, 10px) - 48px, 1px), (min-width: 810px) and (max-width: 1199.98px) max(max((min(min(100vw, 990px) - 40px, 1296px) - 24px) / 2, 10px) - 32px, 1px), (max-width: 809.98px) max(100vw - 32px, 1px)';
const FILL: CSSProperties = { position: 'absolute', borderRadius: 'inherit', top: 0, right: 0, bottom: 0, left: 0 };
const IMG: CSSProperties = { display: 'block', width: '100%', height: '100%', borderRadius: 'inherit', objectPosition: 'center', objectFit: 'cover' };
const PILL = {
  '--border-bottom-width': '0.6000000238418579px',
  '--border-color': tokens.white,
  '--border-left-width': '0.6000000238418579px',
  '--border-right-width': '0.6000000238418579px',
  '--border-style': 'solid',
  '--border-top-width': '0.6000000238418579px',
  backgroundColor: tokens.white,
  borderBottomLeftRadius: '30px',
  borderBottomRightRadius: '30px',
  borderTopLeftRadius: '30px',
  borderTopRightRadius: '30px',
} as CSSProperties;

export function NewsCard({ item, variant }: { item: Card; variant: keyof typeof VARIANT }) {
  const v = VARIANT[variant];
  const radius = { borderBottomLeftRadius: v.radius, borderBottomRightRadius: v.radius, borderTopLeftRadius: v.radius, borderTopRightRadius: v.radius };
  // Stories live on the College's own site until SXCCAA has story pages here.
  const external = /^https?:/.test(item.href);
  return (
    <div className="framer-6dunz9-container" style={{ willChange: 'transform', opacity: 0, transform: 'translateY(40px)' }}>
      <a
        className={`framer-jo2CN framer-PG8vB framer-BPcYF framer-oqfc1u ${v.cls} framer-8lk2q3`}
        data-framer-name={v.name}
        href={item.href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        style={{ backgroundColor: tokens.grey, height: '100%', width: '100%', ...radius }}
      >
        <div className="framer-j7n0as-container">
          <div className="framer-O2QIe framer-yylGA framer-1pdemgs framer-v-1gzcujs" data-border="true" data-framer-name="Secondary" style={PILL}>
            <div className="framer-11s2jci" data-framer-name="Title" data-framer-component-type="RichTextContainer" style={{ '--extracted-r6o4lv': tokens.ink, '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties}>
              <p className="framer-text framer-styles-preset-c29y5p" data-styles-preset="MIzrA6q79" style={{ '--framer-text-color': `var(--extracted-r6o4lv, ${tokens.ink})` } as CSSProperties}>
                {item.category}
              </p>
            </div>
          </div>
        </div>
        <div className="framer-e2rhoe" data-framer-name="Content Wrapper">
          <div className="framer-sugu5n" data-framer-name="Image Wrapper" style={radius}>
            <div className="framer-1s1s5wx" data-framer-name="Image" style={{ transform: 'none' }}>
              <div style={FILL} data-framer-background-image-wrapper="true">
                <img decoding="async" width={item.image.width} height={item.image.height} sizes={SIZES} srcSet={imageSrcSet(item.image)} src={item.image.src} alt={item.image.alt} style={IMG} />
              </div>
            </div>
          </div>
          <div className="framer-nvmo0h" data-framer-name="Text Block">
            <div className="framer-1e9fhz0" data-framer-name="Date" data-framer-component-type="RichTextContainer" style={{ '--extracted-r6o4lv': 'rgba(17, 17, 17, 0.5)', '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties}>
              <p className="framer-text framer-styles-preset-1s2szaz" data-styles-preset="iF_e_kz5u" style={{ '--framer-text-color': 'var(--extracted-r6o4lv, rgba(17, 17, 17, 0.5))' } as CSSProperties}>
                {item.date}
              </p>
            </div>
            <div className="framer-1kifta9" data-framer-name="Title" data-framer-component-type="RichTextContainer" style={{ '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties}>
              <h3 className="framer-text framer-styles-preset-b008ll" data-styles-preset="wv4_2UBIZ">
                {item.title}
              </h3>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}
