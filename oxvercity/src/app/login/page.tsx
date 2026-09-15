/**
 * /login
 *
 * Anonymous: the form. Already signed in: straight to the directory, because a
 * sign-in page is a dead end for someone who is already signed in.
 *
 * ## The door for everybody else
 *
 * Most people who land here are not Xaverians, and the form cannot tell them
 * so — it is built not to know, and if it did know, saying it would turn this
 * page into a way to test whether any given address belongs to an alumnus.
 *
 * So the page says it instead, before anyone types anything: signing in is for
 * alumni the Association has registered, everything else on the site is open,
 * and here is the way through. A visitor who reads that leaves down the right
 * path rather than by failing.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/LoginForm';
import { Footer } from '@/components/layout/Footer';
import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { currentSession } from '@/lib/session-cookie';
import { turnstileSiteKey } from '@/lib/turnstile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in — SXCCAA',
  // A sign-in page in a search index is noise at best; here it also advertises
  // where the private half of the site begins.
  robots: { index: false, follow: false },
};

/** Messages the sign-in routes can hand back through `?e=`. Never free text from the URL. */
const NOTICES: Record<string, string> = {
  slow_down: 'Too many attempts from this connection. Please wait an hour and try again.',
  signed_out: 'You have been signed out.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  if (await currentSession()) redirect('/alumni');

  const { e } = await searchParams;
  const notice = e ? NOTICES[e] : undefined;

  return (
    <SiteShell lightPage footer={<Footer />}>
      <div style={PAGE_ROOT_STYLE}>
        <main className="auth-page">
          <div className="auth-card">
            <p className="auth-eyebrow">Alumni directory</p>
            <h1 className="auth-title">Sign in to view full profiles</h1>
            <p className="auth-lede">
              For Xaverians the Association has registered. Enter the email address it holds for you and
              we will send a six-digit code — there is no password to remember.
            </p>

            <LoginForm siteKey={turnstileSiteKey()} initialNotice={notice} />

            <div className="auth-door">
              <p className="auth-door__title">Not an alumnus?</p>
              <p className="auth-door__body">
                The rest of the site is open to everyone — who we are, what we do, our chapters, our
                events, and the directory itself. Signing in only adds the contact details Xaverians
                have chosen to share with each other.
              </p>
              <a className="auth-door__link" href="/">
                Visit the website
              </a>
            </div>

            <p className="auth-foot">
              A Xaverian, but the Association does not have your address — or it has changed?{' '}
              <a href="/contact">Request access</a> and someone will be in touch.
            </p>
          </div>
        </main>
      </div>
    </SiteShell>
  );
}
