/**
 * The close of the invitation run: the poster's own pull-quote, its triptych,
 * and the line it signs off with.
 *
 * Nothing here is new copy. The quote is set the way the artwork sets it —
 * three quiet lines with one large one in the middle — and the three words
 * that follow are the poster's, verbatim, down to the full stops.
 *
 * The section hands the page back to white, and to the College's own sections
 * below: About, the community, the programmes. A reader who came for the event
 * has everything they need above this; a reader who came for the Association
 * carries on from here.
 */

import { Reveal } from '@/components/motion/Reveal';
import { invitationQuote, nostalgia, pillars } from '@/data/pages/nostalgia';

export function Pillars() {
  return (
    <section className="nos-close" aria-labelledby="nos-close-heading">
      <div className="nos-shell">
        <blockquote className="nos-quote">
          <h2 className="nos-visually-hidden" id="nos-close-heading">
            {nostalgia.closing.call}
          </h2>
          {invitationQuote.lines.map((line, i) => (
            <Reveal
              as="p"
              key={line}
              className={i === invitationQuote.emphasis ? 'nos-quote__line nos-quote__line--big' : 'nos-quote__line'}
              delay={0.07 * i}
              distance={30}
            >
              {line}
            </Reveal>
          ))}
        </blockquote>

        <ul className="nos-pillars">
          {pillars.map((pillar, i) => (
            <Reveal as="li" className="nos-pillar" key={pillar.title} delay={0.09 * i} distance={40}>
              <span className="nos-pillar__index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="nos-pillar__title">{pillar.title}</h3>
              <p className="nos-pillar__body">
                {pillar.lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </p>
            </Reveal>
          ))}
        </ul>

        <Reveal className="nos-creed" distance={26}>
          <span className="nos-rule nos-rule--wide" aria-hidden="true" />
          <p className="nos-creed__call">{nostalgia.closing.call}</p>
          <p className="nos-creed__line">{nostalgia.closing.line}</p>
          <p className="nos-creed__motto">{nostalgia.creed}</p>
          <span className="nos-rule nos-rule--wide" aria-hidden="true" />
        </Reveal>
      </div>
    </section>
  );
}
