'use client';

/**
 * The profile icon in the top right, for signed-in alumni only.
 *
 * ## Why it renders nothing at first
 *
 * The header is on every page, and most of those pages are static. Asking the
 * server who is signed in while rendering them would make the whole site
 * dynamic to decide whether to draw a circle. So this mounts empty, asks
 * `/api/me/summary` once, and appears only if the answer is yes. A visitor who
 * is not signed in sees no flicker, because there is nothing to flicker — the
 * anonymous header is exactly what it was before this file existed.
 *
 * The cost is that a signed-in alumnus sees the icon a beat after the rest of
 * the page. That is the right trade for a control which is a convenience, not a
 * gate: nothing on the site is reachable through this menu that is not
 * reachable without it.
 *
 * ## Sign out is a form, not a fetch
 *
 * `/api/auth/logout` revokes the session server-side and redirects. Posting a
 * real form means it still works if the JavaScript on this page has failed, and
 * means the browser follows the redirect itself rather than this component
 * having to decide where to go afterwards.
 *
 * ## Tone
 *
 * The header inverts on scroll and on light pages; the avatar takes the same
 * `tone` every other control in the bar takes, so it turns with them rather
 * than being the one element that stays white on a white bar.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { tokens } from '@/lib/tokens';

export interface AccountSummary {
  signedIn: boolean;
  name: string | null;
  initials: string;
  photoUrl: string | null;
}

export type Tone = 'light' | 'dark';

/** The first name, for the menu header. "Priya Menon" → "Priya". */
function firstNameOf(name: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/**
 * Ask once, for the whole header.
 *
 * The bar is rendered three times — Framer exports a desktop, a tablet and a
 * phone copy, and the breakpoint stylesheet shows one — so a fetch inside the
 * menu itself would fire three identical requests on every page load, two of
 * them for markup nobody can see. The hook is called once in `Header` and the
 * answer handed to all three.
 */
export function useAccountSummary(): AccountSummary | null {
  const [me, setMe] = useState<AccountSummary | null>(null);

  useEffect(() => {
    let ignore = false;

    function fetchSummary() {
      fetch('/api/me/summary', { credentials: 'same-origin' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: AccountSummary | null) => {
          if (!ignore) setMe(data?.signedIn ? data : null);
        })
        .catch(() => {
          // Signed out is the safe assumption, and the failure mode is a header
          // that looks like it did before. Nothing to tell the visitor.
        });
    }

    fetchSummary();

    // Re-fetch when a photo is uploaded or removed so the header avatar
    // reflects the change without a full page reload.
    function onAccountUpdated() {
      fetchSummary();
    }
    window.addEventListener('account-updated', onAccountUpdated);

    return () => {
      ignore = true;
      window.removeEventListener('account-updated', onAccountUpdated);
    };
  }, []);

  return me;
}

/** Fire from anywhere to make the header re-fetch the account summary. */
export function refreshAccountSummary() {
  window.dispatchEvent(new Event('account-updated'));
}

export function AccountMenu({ tone, me }: { tone: Tone; me: AccountSummary | null }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // A menu that does not close when you click away from it is a menu that
  // follows you down the page. Escape does the same for the keyboard.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Anonymous visitor: show a Login pill instead of nothing.
  if (!me) {
    const color = tone === 'light' ? tokens.white : tokens.ink;
    return (
      <a
        className="acct-login"
        href="/login"
        data-tone={tone}
        style={{ '--acct-ink': color } as CSSProperties}
      >
        Login
      </a>
    );
  }

  const ink = tone === 'light' ? tokens.white : tokens.ink;
  const firstName = firstNameOf(me.name);
  const label = firstName ? `Your account, ${firstName}` : 'Your account';

  return (
    <div className="acct" ref={wrapper}>
      <button
        type="button"
        className="acct__button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{ '--acct-ink': ink } as CSSProperties}
      >
        {me.photoUrl ? (
          <img className="acct__photo" src={me.photoUrl} width={36} height={36} alt="" />
        ) : me.initials ? (
          <span className="acct__initials" aria-hidden="true">
            {me.initials}
          </span>
        ) : (
          /* No directory record yet, so no name to take initials from. */
          <svg className="acct__glyph" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.14 0-7.5 2.35-7.5 5.25V21h15v-1.75C19.5 16.35 16.14 14 12 14Z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="acct__menu" role="menu">
          <div className="acct__who">
            <p className="acct__name">{me.name ?? 'Signed in'}</p>
            <p className="acct__role">Verified Xaverian</p>
          </div>

          <a className="acct__item" role="menuitem" href="/me">
            Your profile
          </a>
          <a className="acct__item" role="menuitem" href="/alumni">
            Alumni directory
          </a>

          <form action="/api/auth/logout" method="post" className="acct__out">
            <button className="acct__item acct__item--button" role="menuitem" type="submit">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
