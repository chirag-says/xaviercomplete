/**
 * "Why Xavier's" — the four things the College says about itself, in the grid
 * rhythm the fact cards elsewhere on the site use.
 */

import { why } from '@/data/pages/about';
import { Reveal } from '@/components/motion/Reveal';
import { SectionHeading } from './SectionHeading';

export function WhySection() {
  return (
    <section className="sx-section sx-section--grey" data-framer-name="Why Section" id="why-xaviers">
      <div className="sx-container">
        <div className="sx-content sx-why">
          <div className="sx-why__head">
            <SectionHeading eyebrow={why.eyebrow} lines={why.lines} />
          </div>
          <div className="sx-why__grid">
            {why.reasons.map((reason, i) => (
              <Reveal key={reason.ordinal} className="sx-reason" delay={0.08 * i} distance={40}>
                <span className="sx-reason__ordinal">{reason.ordinal}</span>
                <h3 className="sx-reason__title framer-text framer-styles-preset-1o91uer">{reason.title}</h3>
                <p className="sx-reason__text framer-text framer-styles-preset-1s2szaz">{reason.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
