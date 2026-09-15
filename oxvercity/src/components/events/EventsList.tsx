/**
 * "Alumni events & activities" — the page's own body.
 *
 * The template has no events page, so this is the rebuild's, built from the
 * template's own measurements the way the alumni directory and the about
 * page's sections are: section padding 150/80/60, container 1800/990/620 at
 * 20px, inner measure 1296px, card radius 15px, and the 0.4s
 * cubic-bezier(.44,0,.56,1) every colour and layout change on the site uses.
 *
 * The Alumni Connect poster leads the page at full size, because it is the one
 * piece of artwork SXCCAA supplied for an event. Entries the Association has
 * not yet given photographs for carry a plate saying so rather than a stand-in
 * photograph.
 */

import { Reveal } from '@/components/motion/Reveal';
import { imageSrcSet } from '@/lib/images';
import { alumniEvents, featuredEvent, eventsPage } from '@/data/pages/events';

const POSTER_SIZES = '(max-width: 809.98px) min(calc(100vw - 40px), 414px), (max-width: 1199.98px) 340px, 414px';
const PHOTO_SIZES = '(max-width: 809.98px) calc(100vw - 40px), (max-width: 1199.98px) calc(50vw - 40px), 620px';

export function EventsList() {
  return (
    <>
      {/* the poster, at the head of the page */}
      <section className="sx-section sx-section--grey" id="alumni-connect" data-framer-name="Featured Event">
        <div className="sx-container">
          <div className="sx-wrapper">
            <Reveal className="sx-poster" distance={40}>
              <div className="sx-poster__media">
                <img
                  decoding="async"
                  width={featuredEvent.poster.width}
                  height={featuredEvent.poster.height}
                  sizes={POSTER_SIZES}
                  srcSet={imageSrcSet(featuredEvent.poster)}
                  src={featuredEvent.poster.src}
                  alt={featuredEvent.poster.alt}
                />
              </div>
              <div className="sx-poster__body">
                <p className="sx-eyebrow sx-eyebrow--ink">{eventsPage.featuredLabel}</p>
                <h2 className="framer-text framer-styles-preset-1tiwwlt sx-poster__title">{featuredEvent.title}</h2>
                <p className="sx-poster__meta framer-text framer-styles-preset-1o91uer">
                  {featuredEvent.date} · {featuredEvent.place}
                </p>
                <p className="framer-text framer-styles-preset-1tfjym1 sx-poster__text">{featuredEvent.description}</p>
                <a className="sx-event__source" href={featuredEvent.source.href} target="_blank" rel="noreferrer">
                  <span>{featuredEvent.source.label}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* every other event */}
      <section className="sx-section" id="events" data-framer-name="Events List">
        <div className="sx-container">
          <div className="sx-wrapper">
            <div className="sx-notice">
              <p className="framer-text framer-styles-preset-1tfjym1">{eventsPage.photoNote}</p>
            </div>
            <ol className="sx-events">
              {alumniEvents.map((event, i) => (
                <Reveal as="li" key={event.id} className="sx-event" delay={0.06 * (i % 3)} distance={40}>
                  <div className="sx-event__head">
                    <p className="sx-event__ordinal">{String(i + 1).padStart(2, '0')}</p>
                    <div className="sx-event__title-block">
                      <h3 className="framer-text framer-styles-preset-1s2szaz sx-event__title">{event.title}</h3>
                      <p className="sx-event__meta">
                        <span>{event.date}</span>
                        {event.place ? <span className="sx-event__dot" aria-hidden="true">·</span> : null}
                        {event.place ? <span>{event.place}</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className="sx-event__body">
                    <p className="framer-text framer-styles-preset-1tfjym1 sx-event__text">{event.description}</p>
                    {event.source ? (
                      <a className="sx-event__source" href={event.source.href} target="_blank" rel="noreferrer">
                        <span>{event.source.label}</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    ) : null}
                  </div>
                  {event.images.length > 0 ? (
                    <div className="sx-event__media" data-count={event.images.length}>
                      {event.images.map((image) => (
                        <figure
                          className="sx-event__figure"
                          key={image.src}
                          /* never scaled past its own resolution: some of the
                             supplied files are small, and an upscaled photo
                             reads as a bad photo */
                          style={{ maxWidth: `${image.width}px` }}
                        >
                          <img
                            decoding="async"
                            loading="lazy"
                            width={image.width}
                            height={image.height}
                            sizes={PHOTO_SIZES}
                            srcSet={imageSrcSet(image)}
                            src={image.src}
                            alt={image.alt}
                          />
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <p className="sx-event__plate">Photographs awaited from SXCCAA</p>
                  )}
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
