/**
 * The "request directory access" band on /contact.
 *
 * Kept visually distinct from the enquiry form above it, because they are
 * different things and running them together confuses both. An enquiry goes to
 * a mailbox; this one asks a person to add your address to an allowlist, needs
 * a code from your inbox, and is refused by default.
 *
 * The copy says who decides and what the answer usually is. A form that implies
 * access is automatic generates a complaint a week later when it turns out not
 * to be.
 */

import { AccessRequestForm } from './AccessRequestForm';

export function AccessRequestSection({ siteKey }: { siteKey: string | null }) {
  return (
    <section className="req-section" id="request-access">
      <div className="req-shell">
        <div className="req-head">
          <p className="req-eyebrow">Directory access</p>
          <h2 className="req-title">Ask for access to the alumni directory</h2>
          <p className="req-lede">
            Full profiles are open to Xaverians whose address the Association already holds. If yours is
            not on that list — you have changed email since you filled in the form, or you were never
            asked — this is the way in.
          </p>
        </div>

        <div className="req-card">
          <AccessRequestForm siteKey={siteKey} />
        </div>

        <ol className="req-steps">
          <li>
            <strong>You give us your details.</strong> Enough for the Association to match you against
            their records.
          </li>
          <li>
            <strong>We email you a code.</strong> Typing it back proves you can read mail at that
            address — otherwise anyone could put someone else&rsquo;s address into the queue.
          </li>
          <li>
            <strong>A person decides.</strong> There is no automatic approval. If it is granted you can
            sign in; if not, you get a short email and can ask again after thirty days.
          </li>
        </ol>

        <p className="req-foot">
          Already have access? <a href="/login">Sign in</a> — there is no password, we email you a
          six-digit code each time.
        </p>
      </div>
    </section>
  );
}
