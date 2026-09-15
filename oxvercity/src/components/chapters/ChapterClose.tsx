/**
 * The foot: the three ways on from this page, and nothing else.
 *
 * There was a closing statement here — a screen of headline over the crest —
 * and it is gone. The page already ends on the network, which is the thought
 * that statement was restating, so all that was left to do was hand the reader
 * somewhere to go. What remains is a slim bar on the same night ground the
 * network sits on, so the two read as one closing movement rather than as a
 * section and then a footer.
 *
 * The directory is the primary action; the Association and the chapter's own
 * site sit beside it as quiet links, because both were on the page this
 * replaces and losing either would cost a reader something.
 *
 * No heading, so the region is labelled instead. Nothing here animates on
 * entry — a row of links that fades in is a row of links you cannot click yet.
 */

import { closing, westZone } from '@/data/pages/chapters';

export function ChapterClose() {
  return (
    <section className="cx-close" aria-label="Keep exploring">
      <div className="ev-shell cx-close__bar">
        <a className="cx-close__cta" href={closing.cta.href}>
          <span>{closing.cta.label}</span>
          <span className="cx-close__arrow" aria-hidden="true">
            →
          </span>
        </a>

        <p className="cx-close__links">
          <a className="cx-close__quiet" href={westZone.contact.href}>
            {westZone.contact.label}
          </a>
          <span className="cx-close__sep" aria-hidden="true" />
          <a className="cx-close__quiet" href={westZone.source.href} target="_blank" rel="noreferrer">
            {westZone.source.label} <span aria-hidden="true">↗</span>
          </a>
        </p>
      </div>
    </section>
  );
}
