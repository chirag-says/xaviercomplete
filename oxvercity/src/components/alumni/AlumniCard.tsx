/**
 * One alumnus in the directory grid.
 *
 * Two variants, and the difference is structural rather than cosmetic:
 *
 *   - **Verified** — an `<a>` to the full profile, with the hover overlay.
 *   - **Anonymous** — a `<div>`. No href, no overlay element, nothing to click.
 *
 * The overlay is not hidden with CSS for signed-out visitors; it is not in the
 * markup. That matters less here than on the profile page — the overlay only
 * repeats public fields — but the habit is the point. The moment "hidden" and
 * "absent" are treated as interchangeable in this codebase, the next field
 * someone hides that way will be a phone number.
 *
 * Every field rendered below comes from `PublicAlumnus`, which is the type the
 * loader hands out to anyone. There is no branch here that could reveal more to
 * a signed-in viewer, because this component is never given more.
 */

import { DEMO_BADGE } from '@/data/alumni';
import type { PublicAlumnus } from '@/lib/visibility';

const AVATAR = '/svg/alumni-avatar.svg';

/** "Product Manager, Sample Technology" — skipping whichever half is missing. */
function roleLine(person: PublicAlumnus): string | null {
  const parts = [person.designation, person.currentOrg].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function CardInner({ person, isDemo, isVerified }: { person: PublicAlumnus; isDemo: boolean; isVerified: boolean }) {
  const role = roleLine(person);

  return (
    <>
      <div className="al-card__photo">
        <img
          src={person.photoUrl ?? AVATAR}
          width={400}
          height={533}
          alt=""
          decoding="async"
        />
        <div className="al-card__tags">
          {isDemo && <span className="al-card__tag al-card__tag--demo">{DEMO_BADGE}</span>}
          <span className="al-card__tag">Class of {person.batchYear}</span>
        </div>

        {/* Verified only — see the note at the top of this file. */}
        {isVerified && (
          <div className="al-card__overlay">
            {role && <p className="al-card__overlay-role">{role}</p>}
            {person.stream && <p className="al-card__overlay-location">{person.stream}</p>}
            <span className="al-card__overlay-cta">
              View full profile <span aria-hidden="true">→</span>
            </span>
          </div>
        )}
      </div>

      <div className="al-card__body">
        <h3 className="al-card__name">{person.fullName}</h3>
        {role && <p className="al-card__meta">{role}</p>}
        {person.stream && <p className="al-card__meta al-card__meta--dim">{person.stream}</p>}
      </div>
    </>
  );
}

export function AlumniCard({
  person,
  isVerified,
  isDemo = false,
}: {
  person: PublicAlumnus;
  isVerified: boolean;
  isDemo?: boolean;
}) {
  if (!isVerified) {
    return (
      <div className="al-card al-card--locked">
        <CardInner person={person} isDemo={isDemo} isVerified={false} />
      </div>
    );
  }

  return (
    <a className="al-card" href={`/alumni/${person.id}`}>
      <CardInner person={person} isDemo={isDemo} isVerified />
    </a>
  );
}
