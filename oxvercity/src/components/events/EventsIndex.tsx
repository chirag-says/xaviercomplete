/**
 * The turn between the opening and the story: what the Association runs, set
 * as a contents page, against the one piece of artwork it has supplied.
 *
 * The strands are counted off the archive rather than written down, so the
 * figures cannot drift from the entries. The Alumni Connect poster is printed
 * matter, not a photograph, so it is framed as a printed thing — held at its
 * own 414px width, on the grey the rest of the site uses for a plate.
 */

import { Reveal } from '@/components/motion/Reveal';
import { alumniEvents, eventsPage, featuredEvent, strands } from '@/data/pages/events';

const counted = strands
  .filter((strand) => strand.id !== 'all')
  .map((strand) => ({
    ...strand,
    count: alumniEvents.filter((event) => event.strands.includes(strand.id as never)).length,
  }));

export function EventsIndex() {
  return (
    <section className="ev-index" aria-labelledby="index-heading">
      <div className="ev-shell ev-index__shell">
        <div className="ev-index__lead">
          <h2 className="ev-index__statement" id="index-heading">
            The Association’s year runs on service, sport and fellowship — kept here as the
            record of what actually happened, and nothing more.
          </h2>
          <p className="ev-index__intro">{eventsPage.intro}</p>

          <ol className="ev-index__strands">
            {counted.map((strand) => (
              <li key={strand.id}>
                <a href="#archive">
                  <span className="ev-index__strandName">{strand.label}</span>
                  <span className="ev-index__strandRule" aria-hidden="true" />
                  <span className="ev-index__strandCount">{String(strand.count).padStart(2, '0')}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>

        <Reveal className="ev-index__poster" distance={40}>
          <p className="ev-eyebrow">Supplied artwork</p>
          <figure>
            <img
              src={featuredEvent.poster.src}
              width={featuredEvent.poster.width}
              height={featuredEvent.poster.height}
              alt={featuredEvent.poster.alt}
              loading="lazy"
              decoding="async"
              sizes="(max-width: 809.98px) min(calc(100vw - 40px), 414px), 414px"
            />
            <figcaption>
              <span className="ev-index__posterTitle">{featuredEvent.title}</span>
              <span className="ev-index__posterMeta">{featuredEvent.date}</span>
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
