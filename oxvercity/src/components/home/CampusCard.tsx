import type { CSSProperties } from 'react';
import { imageSrcSet } from '@/lib/images';
import { tokens } from '@/lib/tokens';
import type { CampusCard as Card } from '@/data/pages/home';

/**
 * A card in "Inside the world of campus" (`framer-2O3NQ`): a full-bleed image
 * under a gradient, title and paragraph at the bottom. The image, overlay and
 * text reveal on scroll (effects keyed by their classes).
 */

const VARIANT = {
  desktop: { cls: 'framer-v-1k582g5', name: 'Desktop', radius: '16px' },
  phone: { cls: 'framer-v-af15zg', name: 'Phone', radius: '12px' },
} as const;
const SIZES =
  '(min-width: 1200px) max(max((min(min(100vw, 1800px) - 40px, 1296px) - 24px) / 2, 1px), 1px), (max-width: 809.98px) max(100vw, 1px), (min-width: 810px) and (max-width: 1199.98px) max(max((min(min(100vw, 990px) - 40px, 1296px) - 24px) / 2, 1px), 1px)';
const WHITE80 = 'var(--token-64ea5169-a638-4017-b73c-ec045eca97b4, rgba(255, 255, 255, 0.8))';
const FILL: CSSProperties = { position: 'absolute', borderRadius: 'inherit', top: 0, right: 0, bottom: 0, left: 0 };

export function CampusCard({ card, variant, containerClass, reveal }: { card: Card; variant: keyof typeof VARIANT; containerClass: string; reveal?: string }) {
  const v = VARIANT[variant];
  return (
    <div className={containerClass} style={reveal ? { willChange: 'transform', opacity: 0, transform: reveal } : undefined}>
      <div
        className={`framer-2O3NQ framer-lytYB framer-RqKzS framer-1k582g5 ${v.cls}`}
        data-framer-name={v.name}
        style={{ height: '100%', maxHeight: '100%', width: '100%', borderBottomLeftRadius: v.radius, borderBottomRightRadius: v.radius, borderTopLeftRadius: v.radius, borderTopRightRadius: v.radius }}
      >
        <div className="framer-zhnp3l" data-framer-name="Image Wrap">
          <div className="framer-1u1o8a3" data-framer-name="BG Image" style={{ willChange: 'transform', opacity: 0, transform: 'scale(1.1)' }}>
            <div style={FILL} data-framer-background-image-wrapper="true">
              <img
                decoding="async"
                width={card.image.width}
                height={card.image.height}
                sizes={SIZES}
                srcSet={imageSrcSet(card.image)}
                src={card.image.src}
                alt={card.image.alt}
                style={{ display: 'block', width: '100%', height: '100%', borderRadius: 'inherit', objectPosition: card.image.position ?? 'center', objectFit: 'cover' }}
              />
            </div>
          </div>
          <div
            className="framer-1awlqq4"
            data-framer-name="BG Overlay"
            style={{ background: 'linear-gradient(180deg, var(--token-fe810758-ba26-4c60-a7b7-193cf95cf6ce, rgba(255, 255, 255, 0)) 0%, rgba(17, 17, 17, 0.95) 100%)', willChange: 'transform', opacity: 0, transform: 'none' }}
          />
        </div>
        <div className="framer-y4qhjj" data-framer-name="Text Block" style={{ willChange: 'transform', opacity: 0, transform: 'translateY(40px)' }}>
          <div className="framer-1vgk5de" data-framer-name="Title" data-framer-component-type="RichTextContainer" style={{ '--extracted-a0htzi': tokens.white, '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties}>
            <h3 className="framer-text framer-styles-preset-11yr44y" data-styles-preset="FFs_zSJqj" style={{ '--framer-text-color': `var(--extracted-a0htzi, ${tokens.white})` } as CSSProperties}>
              {card.title}
            </h3>
          </div>
          <div className="framer-qvg0cw" data-framer-name="Paragraph" data-framer-component-type="RichTextContainer" style={{ '--extracted-r6o4lv': WHITE80, '--framer-paragraph-spacing': '0px', transform: 'none' } as CSSProperties}>
            <p className="framer-text framer-styles-preset-1yx751z" data-styles-preset="kfKr753OE" style={{ '--framer-text-color': `var(--extracted-r6o4lv, ${WHITE80})` } as CSSProperties}>
              {card.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
