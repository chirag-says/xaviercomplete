/**
 * What a signed-out visitor sees where the profiles would be.
 *
 * Shown above the grid rather than over it. A gate that covers the content is a
 * wall; a gate that stands beside content you can already browse is an
 * invitation, and browsing the names is the thing that makes someone want to
 * sign in.
 *
 * The wording avoids implying that anyone can get access by signing up. There
 * is no self-registration (plan §14) — either the Association already holds
 * your address or an admin has to grant it — and saying so here saves people
 * from trying the login form with an address that was never on the list.
 */

export function SignInPrompt() {
  return (
    <section className="al-gate">
      <div className="al-shell">
        <div className="al-gate__card">
          <p className="al-eyebrow">Xaverians only</p>
          <h2 className="al-gate__title">Sign in to open full profiles</h2>
          <p className="al-gate__body">
            The directory below is open to everyone. Full profiles — including the contact details each
            alumnus has chosen to share — are visible only to Xaverians signed in with the email address
            the Association holds for them.
          </p>
          <div className="al-gate__actions">
            <a className="al-gate__btn" href="/login">Sign in</a>
            <a className="al-gate__link" href="/contact#request-access">
              Not on the list? Request access <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
