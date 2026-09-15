'use client';

/**
 * Featured Xaverians — editorial tab section.
 * Left: a list of featured profiles. Right: a portrait that fades between them.
 *
 * Public tier throughout. This band sits high on a page anyone can open, so it
 * shows the same five fields a card does and nothing more — including for a
 * signed-in viewer, who gets the extra detail by opening the profile.
 */

import { useState } from 'react';

import { DEMO_BADGE } from '@/data/alumni';
import type { PublicAlumnus } from '@/lib/visibility';

const AVATAR = '/svg/alumni-avatar.svg';

const roleLine = (person: PublicAlumnus) =>
  [person.designation, person.currentOrg].filter(Boolean).join(', ');

export function AlumniFeatured({
  people,
  isDemo = false,
}: {
  people: PublicAlumnus[];
  isDemo?: boolean;
}) {
  const [active, setActive] = useState(0);

  // An empty directory renders nothing rather than an empty frame. Real on day
  // one, before the first import.
  if (people.length === 0) return null;

  const person = people[Math.min(active, people.length - 1)]!;

  return (
    <section className="al-featured" id="featured">
      <div className="al-shell">
        <div className="al-featured__head">
          <p className="al-eyebrow">Spotlight</p>
          <h2 className="al-featured__title">Featured Xaverians</h2>
        </div>

        <div className="al-featured__layout">
          {/* Left — tab list */}
          <div className="al-featured__tabs" role="tablist">
            {people.map((p, i) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={i === active}
                className="al-featured__tab"
                data-active={String(i === active)}
                onClick={() => setActive(i)}
              >
                <p className="al-featured__tab-year">Class of {p.batchYear}</p>
                <p className="al-featured__tab-name">{p.fullName}</p>
                {roleLine(p) && <p className="al-featured__tab-meta">{roleLine(p)}</p>}
                {p.stream && <p className="al-featured__tab-meta">{p.stream}</p>}
              </button>
            ))}
          </div>

          {/* Right — portrait */}
          <div className="al-featured__portrait">
            <div className="al-featured__portrait-frame">
              <img
                key={person.id}
                src={person.photoUrl ?? AVATAR}
                width={400}
                height={533}
                alt=""
                decoding="async"
              />
            </div>
            <div className="al-featured__portrait-info">
              <h3 className="al-featured__portrait-name">{person.fullName}</h3>
              {roleLine(person) && <p className="al-featured__portrait-role">{roleLine(person)}</p>}
              {person.stream && (
                <p className="al-featured__portrait-location">
                  {person.stream} · Class of {person.batchYear}
                </p>
              )}
              {isDemo && <span className="al-featured__portrait-badge">{DEMO_BADGE}</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
