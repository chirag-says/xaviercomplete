/**
 * "The College" — the last of the about page's hand-written sections, and the
 * one that carries what the sections above it do not already say.
 *
 * Three text treatments, no cards: the four marks as a hairline-ruled list that
 * reads down like a manifesto, the motto set as display type over its
 * translation, and the affiliations as a rail of label-and-value pairs. The
 * ground stays close to the page's own white — the section earns its weight
 * from type and rules rather than from a change of colour.
 */

import { college } from '@/data/pages/about';
import { Reveal } from '@/components/motion/Reveal';
import { SectionHeading } from './SectionHeading';

export function CollegeSection() {
  return (
    <section className="sx-section sx-college" data-framer-name="College Section" id="the-college">
      <div className="sx-container">
        <div className="sx-content sx-college__inner">
          <div className="sx-college__top">
            <div className="sx-college__head">
              <SectionHeading eyebrow={college.eyebrow} lines={college.lines} />
            </div>
            <div className="sx-college__body">
              <Reveal className="sx-college__lead framer-text framer-styles-preset-18gc2kl" distance={40}>
                {college.lead}
              </Reveal>
              <ol className="sx-marks">
                {college.marks.map((mark, i) => (
                  <Reveal key={mark} as="li" className="sx-marks__item" delay={0.07 * i} distance={30}>
                    <span className="sx-marks__rule" aria-hidden="true" />
                    <span className="sx-marks__word framer-text framer-styles-preset-11yr44y">{mark}</span>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>

          <Reveal className="sx-motto" distance={40}>
            <p className="sx-eyebrow sx-eyebrow--ink sx-motto__eyebrow">{college.motto.eyebrow}</p>
            <p className="sx-motto__latin">{college.motto.latin}</p>
            <p className="sx-motto__gloss">{college.motto.gloss}</p>
            <dl className="sx-rail">
              {college.facts.map((fact) => (
                <div key={fact.label} className="sx-rail__item">
                  <dt className="sx-rail__label">{fact.label}</dt>
                  <dd className="sx-rail__value framer-text framer-styles-preset-1s2szaz">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
