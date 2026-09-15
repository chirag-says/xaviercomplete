/**
 * A full alumni profile. Reachable only with a session (see the route).
 *
 * The type is the security boundary. This component takes `PrivateAlumnus`, and
 * the only function that produces one is `readProfile`, which requires a
 * `Session`. There is no path from an anonymous request to this markup.
 *
 * ## Why "Not shared" is rendered at all
 *
 * The optional fields are absent from the object when their owner's toggle is
 * off, so nothing here can print a hidden number by mistake — `person.contact`
 * is `undefined`, not a string waiting to be revealed. What the reader sees
 * instead is a plain "Not shared", which is deliberate: an omitted row looks
 * like a bug and prompts someone to go looking, while a stated one tells the
 * truth — this person chose not to publish it — and closes the question.
 */

import { DEMO_BADGE, directoryCopy } from '@/data/alumni';
import type { PrivateAlumnus } from '@/lib/visibility';

const AVATAR = '/svg/alumni-avatar.svg';

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="al-profile__fact">
      <dt>{label}</dt>
      <dd>{value ?? <span className="al-profile__unshared">Not shared</span>}</dd>
    </div>
  );
}

export function AlumniProfileView({
  person,
  isDemo = false,
}: {
  person: PrivateAlumnus;
  isDemo?: boolean;
}) {
  const role = [person.designation, person.currentOrg].filter(Boolean).join(', ');

  return (
    <section className="al-profile-page">
      <div className="al-shell">
        <div className="al-profile">
          {/* Sidebar */}
          <aside className="al-profile__aside">
            <div className="al-profile__photo">
              <img src={person.photoUrl ?? AVATAR} width={400} height={400} alt="" decoding="async" />
            </div>
            <div className="al-profile__pills">
              {isDemo && (
                <span className="al-profile__pill al-profile__pill--demo">{DEMO_BADGE} record</span>
              )}
              <span className="al-profile__pill">Class of {person.batchYear}</span>
              {person.stream && <span className="al-profile__pill">{person.stream}</span>}
            </div>

            {/* Contact. Present here only because a session reached this page
                and the owner left the toggle on. */}
            <div className="al-profile__contact">
              <h2 className="al-profile__section-title">Contact</h2>
              <dl className="al-profile__facts al-profile__facts--stack">
                <Fact label="Phone" value={person.contact ?? null} />
                <Fact label="Email" value={person.gmail ?? null} />
              </dl>
            </div>
          </aside>

          {/* Main content */}
          <div className="al-profile__main">
            <div>
              <h1 className="al-profile__name">{person.fullName}</h1>
              {role && <p className="al-profile__role">{role}</p>}
            </div>

            <div>
              <h2 className="al-profile__section-title">Details</h2>
              <dl className="al-profile__facts">
                <Fact label="Batch / Year of passing" value={person.batchYear} />
                <Fact label="Stream of study" value={person.stream} />
                <Fact label="Current organisation" value={person.currentOrg} />
                <Fact label="Designation and role" value={person.designation} />
                <Fact label="Previous organisation / role" value={person.previousRole ?? null} />
              </dl>
            </div>

            {person.otherInfo && (
              <div>
                <h2 className="al-profile__section-title">Other information</h2>
                <p className="al-profile__bio">{person.otherInfo}</p>
              </div>
            )}

            <p className="al-profile__privacy">{directoryCopy.privacyNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
