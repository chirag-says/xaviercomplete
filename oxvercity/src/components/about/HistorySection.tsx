/**
 * "History of the College" — the founding story as a dated timeline.
 *
 * The heading block sticks while the milestones scroll past it on desktop, the
 * way the site's two-column sections behave; below 1200px it stacks. Each
 * milestone fades up in turn on the site's scroll reveal.
 */

import { history } from '@/data/pages/about';
import { imageSrcSet } from '@/lib/images';
import { Reveal } from '@/components/motion/Reveal';
import { SectionHeading } from './SectionHeading';

const IMAGE_SIZES =
  '(min-width: 1200px) min(min(min(100vw, 1800px) - 40px, 1296px) * 0.36, 460px), (max-width: 1199.98px) min(min(100vw, 990px) - 40px, 1296px)';

export function HistorySection() {
  return (
    <section className="sx-section" data-framer-name="History Section" id="history">
      <div className="sx-container">
        <div className="sx-content sx-history">
          <div className="sx-history__aside">
            <SectionHeading eyebrow={history.eyebrow} lines={history.lines} />
            <Reveal className="sx-history__intro framer-text framer-styles-preset-1s2szaz" delay={0.2} distance={40}>
              {history.intro}
            </Reveal>
            <Reveal className="sx-history__figure" delay={0.3} distance={40}>
              <img
                decoding="async"
                loading="lazy"
                width={history.image.width}
                height={history.image.height}
                sizes={IMAGE_SIZES}
                srcSet={imageSrcSet(history.image)}
                src={history.image.src}
                alt={history.image.alt}
              />
            </Reveal>
          </div>
          <ol className="sx-timeline">
            {history.milestones.map((milestone, i) => (
              <Reveal key={milestone.year} as="li" className="sx-timeline__item" delay={0.08 * i} distance={40}>
                <div className="sx-timeline__year">{milestone.year}</div>
                <div className="sx-timeline__body">
                  <h3 className="sx-timeline__title framer-text framer-styles-preset-1o91uer">{milestone.title}</h3>
                  <p className="sx-timeline__text framer-text framer-styles-preset-1s2szaz">{milestone.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
