/**
 * /me — the alumnus's own profile.
 *
 * Redirect to /login rather than 404 for a signed-out visitor. The profile
 * pages 404 because a redirect there would confirm that a particular alumnus
 * exists; this page is about whoever is asking, so it reveals nothing about
 * anybody and a redirect is simply more useful.
 *
 * An address can be on the allowlist without having a directory record — an
 * admin can grant access to someone the spreadsheet has not caught up with. That
 * is a real state and gets an explanation rather than an error.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Footer } from '@/components/layout/Footer';
import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { ProfileEditor } from '@/components/alumni/ProfileEditor';
import { readOwnProfile } from '@/lib/me';
import { currentSession } from '@/lib/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your profile — SXCCAA',
  robots: { index: false, follow: false },
};

export default async function MePage() {
  const session = await currentSession();
  if (!session) redirect('/login');

  const profile = await readOwnProfile(session);

  return (
    <SiteShell lightPage footer={<Footer />}>
      <div style={PAGE_ROOT_STYLE}>
        <main className="me-page">
          <div className="al-shell">
            <header className="me-head">
              <p className="al-eyebrow">Your profile</p>
              <h1 className="me-head__title">
                {profile ? profile.fullName : 'Your profile'}
              </h1>
              <p className="me-head__lede">
                This is what other Xaverians see, and what they do not. Everything on this page is yours
                to change.
              </p>
            </header>

            {profile ? (
              <ProfileEditor profile={profile} />
            ) : (
              <div className="me-card">
                <h2 className="me-card__title">We do not have a directory record for you yet</h2>
                <p className="me-card__lede">
                  Your address can sign in, but it has not been matched to an entry in the alumni
                  directory — usually because the Association granted access before the next data load.
                  Get in touch and they will add your record, after which everything on this page becomes
                  available.
                </p>
                <p>
                  <a className="me-btn" href="/contact">Contact the Association</a>
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </SiteShell>
  );
}
