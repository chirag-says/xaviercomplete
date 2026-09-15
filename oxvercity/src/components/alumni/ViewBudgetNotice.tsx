/**
 * Shown when a signed-in Xaverian has opened a lot of profiles.
 *
 * Not an error and not an accusation. The overwhelming majority of people who
 * see this were browsing, and the wording has to leave them feeling trusted
 * rather than caught — while being honest that a limit exists and why.
 *
 * It says the limit resets rather than asking them to contact anybody: a
 * support request the Association cannot act on is worse for both sides than
 * waiting an hour.
 */

import { directoryCopy } from '@/data/alumni';

export function ViewBudgetNotice() {
  return (
    <section className="al-gate">
      <div className="al-shell">
        <div className="al-gate__card">
          <p className="al-eyebrow">Take a breather</p>
          <h2 className="al-gate__title">You have opened a lot of profiles</h2>
          <p className="al-gate__body">
            The directory limits how many full profiles one person can open in a short stretch. It is
            there because these are five hundred Xaverians&rsquo; phone numbers and email addresses, and
            the Association promised them it would not become a list anyone could copy in an afternoon.
          </p>
          <p className="al-gate__body">
            Nothing is wrong with your account. The limit lifts within the hour, and the directory
            itself is still open — only the full profiles are paused.
          </p>
          <div className="al-gate__actions">
            <a className="al-gate__btn" href="/alumni">Back to the directory</a>
            <a className="al-gate__link" href="/contact">
              Need to reach someone urgently? <span aria-hidden="true">→</span>
            </a>
          </div>
          <p className="al-gate__body" style={{ marginTop: 4, fontSize: 13 }}>
            {directoryCopy.privacyNote}
          </p>
        </div>
      </div>
    </section>
  );
}
