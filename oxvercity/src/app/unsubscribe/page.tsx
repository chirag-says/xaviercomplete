/**
 * /unsubscribe — stop the Association writing to me.
 *
 * Reached from the footer of any mailing, by someone who is not signed in and
 * should not have to be. Under the DPDP Act withdrawal must be as easy as the
 * consent was; in practice the bar is higher than the law's, because an
 * unsubscribe link that demands a sign-in is one that gets the message marked
 * as spam instead, and that costs the Association every future delivery.
 *
 * ## Why it takes a click rather than acting on page load
 *
 * Mail clients and security scanners fetch the links in a message before a
 * human sees it. A GET that unsubscribed on arrival would quietly remove people
 * who never touched it, and they would never know — the most damaging failure
 * this page could have, because it looks exactly like nothing happening.
 *
 * So the link renders a page with a button, and the button POSTs.
 *
 * ## What the token is
 *
 * A peppered HMAC of the alumni id — see `unsubscribeToken` in core/hmac.ts. It
 * never expires, because an unsubscribe link that stops working in a two-year
 * old email is an unsubscribe link that fails the one time someone reaches for
 * it. It authorises exactly one change to one flag and cannot sign anybody in.
 *
 * ## What this page will not say
 *
 * Not the person's name, not their address. The link arrived in their mailbox,
 * so we would only be reciting something they already have — and a page that
 * printed a name for any id plus token pair would turn a forwarded email into a
 * lookup tool.
 */

import type { Metadata } from 'next';

import { Footer } from '@/components/layout/Footer';
import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { isAlumniId } from '@/lib/core/ids';
import { unsubscribeTokenMatches } from '@/lib/core/hmac';
import { optOutOfMail } from './actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Email preferences — SXCCAA',
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; t?: string; done?: string }>;
}) {
  const { id, t, done } = await searchParams;

  const valid = typeof id === 'string' && isAlumniId(id) && unsubscribeTokenMatches(id, t);

  return (
    <SiteShell lightPage footer={<Footer />}>
      <div style={PAGE_ROOT_STYLE}>
        <main className="auth-page">
          <div className="auth-card">
            <p className="auth-eyebrow">Email preferences</p>

            {done === '1' ? (
              <>
                <h1 className="auth-title">You are unsubscribed</h1>
                <p className="auth-lede">
                  The Association will not email you about events or announcements again. Nothing else
                  changed — your directory profile is exactly as it was, and you can still sign in
                  whenever you like.
                </p>
                <p className="auth-foot">
                  Changed your mind, or did this by accident? <a href="/contact">Get in touch</a> and the
                  Association will put you back on the list.
                </p>
              </>
            ) : valid ? (
              <>
                <h1 className="auth-title">Stop receiving these emails?</h1>
                <p className="auth-lede">
                  You will no longer get event invitations or announcements from the Association. This
                  does <strong>not</strong> remove you from the alumni directory and does not affect your
                  ability to sign in — it only stops the email.
                </p>

                <form action={optOutOfMail}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="t" value={t ?? ''} />
                  <button className="auth-submit" type="submit">
                    Unsubscribe me
                  </button>
                </form>

                <div className="auth-door">
                  <p className="auth-door__title">Would you rather leave the directory instead?</p>
                  <p className="auth-door__body">
                    That is a different thing, and it is yours to do: sign in and choose &ldquo;remove me
                    from the directory&rdquo; on your profile. It takes one click and needs nobody&rsquo;s
                    approval.
                  </p>
                  <a className="auth-door__link" href="/me">
                    Open my profile
                  </a>
                </div>
              </>
            ) : (
              <>
                <h1 className="auth-title">This link is not valid</h1>
                <p className="auth-lede">
                  It may have been copied incompletely — mail clients sometimes break a long link across
                  two lines. Try clicking it directly from the email rather than pasting it.
                </p>
                <p className="auth-foot">
                  Still stuck? <a href="/contact">Tell the Association</a> and someone will take you off
                  the list by hand.
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </SiteShell>
  );
}
