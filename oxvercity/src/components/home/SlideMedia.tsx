/**
 * The image behind a "Xaverian community" card.
 *
 * The Association has not supplied photography for these three cards yet, so a
 * slide with no `image` shows a "Coming soon" plate instead of a stock
 * photograph. It occupies the same `framer-1jldtx4` slot the picture would, so
 * the card's gradient, pill, title, paragraph and every animation are
 * untouched — dropping an `image` back into the data restores the photograph.
 *
 * The slot is marked when it is standing in, because it is a flex item sized
 * `flex: 1 0 0; width: 1px` — it takes its width from the row it sits in. On
 * the phone card the text block shares that row, which left the slot at a
 * pixel and threw the plate's label out past the left edge of the card. The
 * stylesheet lifts a standing-in slot out of the row.
 */

import { imageSrcSet } from '@/lib/images';
import type { SiteImage } from '@/lib/images';

const SIZES =
  '(min-width: 1200px) max(max(1296px, 1px), max(100vw, 1px)), (max-width: 809.98px) max(max(1296px, 1px), max(100vw, 1px)), (min-width: 810px) and (max-width: 1199.98px) max(max(810px, 1px), max(100vw, 1px))';

export const COMING_SOON_LABEL = 'Coming soon';

export function SlideMedia({ image }: { image?: SiteImage }) {
  return (
    <div className="framer-1jldtx4" data-framer-name="BG Image" data-plate={image ? undefined : ''}>
      {image ? (
        <div style={{ position: 'absolute', borderRadius: 'inherit', top: 0, right: 0, bottom: 0, left: 0 }} data-framer-background-image-wrapper="true">
          <img
            decoding="async"
            width={image.width}
            height={image.height}
            sizes={SIZES}
            srcSet={imageSrcSet(image)}
            src={image.src}
            alt={image.alt}
            style={{ display: 'block', width: '100%', height: '100%', borderRadius: 'inherit', objectPosition: image.position ?? 'center', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <div className="site-coming-soon">
          <p className="framer-text framer-styles-preset-c29y5p" data-styles-preset="MIzrA6q79">
            {COMING_SOON_LABEL}
          </p>
        </div>
      )}
    </div>
  );
}
