/**
 * The photograph under the hero: the Secretary at the podium at Nostalgia '26,
 * with a short note under it saying who he is. Hand-written, not from the
 * Framer export — the template has no "one photograph and a caption" block —
 * and sits first in the white section wrapper so it slides over the sticky
 * hero the way the About section did before it.
 *
 * The frame is SHUB4128 from the same Cloudinary upload the gallery reads
 * (`oxvercity/gallery/`, 2560 on the long edge), served at the 1296px measure
 * through the same `sizes` the gallery's full-width rows use. It is below the
 * fold on every viewport, so it loads lazily. Copy lives in `hero.podium`
 * (`data/pages/home.ts`); styling in `site.css` under "podium photograph".
 */

import { cloudinaryIdUrl } from '@/lib/cloudinary';
import { podium } from '@/data/pages/home';

const WIDTHS = [640, 1024, 1600, 2560];

export function PodiumSection() {
  return (
    <section className={"sx-podium"} aria-label={podium.photo.alt}>
      <div className={"sx-podium__shell"}>
        <figure className={"sx-podium__figure"}>
          <span className={"sx-podium__frame"}>
            <img
              src={cloudinaryIdUrl(podium.photo.id, { width: 1600 })}
              srcSet={WIDTHS.map((w) => `${cloudinaryIdUrl(podium.photo.id, { width: w })} ${w}w`).join(', ')}
              sizes={"(min-width: 1336px) 1296px, 100vw"}
              width={podium.photo.width}
              height={podium.photo.height}
              alt={podium.photo.alt}
              loading={"lazy"}
              decoding={"async"}
            />
          </span>
          <figcaption className={"sx-podium__caption"}>
            <p className={"framer-text framer-styles-preset-18gc2kl sx-podium__who"} data-styles-preset={"mM0cFQnf6"}>
              <strong>{podium.name}</strong>
              <span className={"sx-podium__sep"} aria-hidden="true">·</span>
              {podium.role}
            </p>
            <p className={"framer-text framer-styles-preset-18gc2kl sx-podium__line"} data-styles-preset={"mM0cFQnf6"}>
              {podium.line}
            </p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
