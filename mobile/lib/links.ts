/**
 * Website href → app route.
 *
 * **The app's routes are the website's paths.** `/about` on the site is `/about`
 * in the app, `/chapters` is `/chapters`, and so on. That is not a convenience —
 * it is what makes the app a reproduction rather than a reinterpretation: there
 * is no mapping table to drift, and a deep link from an email or the website
 * lands on the same page.
 *
 * An earlier version routed everything through `/more/[page]`, which is how
 * `/alumni#featured` turned into `/more/alumni%23featured` — a page that did not
 * exist. Keeping the site's own paths removes that whole class of bug.
 *
 * What remains here is small and real:
 *
 *  - **strip the fragment.** `/alumni#featured` is a scroll target on the web
 *    and has no meaning in a native route; it resolves to `/alumni`.
 *  - **drop what the app has no screen for**, so a menu entry never renders as
 *    a link that lands nowhere.
 *  - **refuse external links**, which the caller opens in the browser instead.
 */

import type { Href } from 'expo-router';

/**
 * Every path the app has a screen for — the website's own paths, verbatim.
 *
 * `/search` is deliberately absent: the website has the page, the app defers it
 * past 1.0, and listing it here would render a link to a screen that does not
 * exist.
 */
const ROUTES = new Set([
  '/',
  '/about',
  '/alumni',
  '/chapters',
  '/events',
  '/explore',
  '/contact',
  '/privacy-policy',
  '/terms-of-use',
]);

export interface ResolvedLink {
  href: Href;
}

export function resolveLink(href: string): ResolvedLink | null {
  if (!href) return null;

  if (/^https?:\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }

  // The fragment and any query are scroll/state on the web; neither survives.
  const path = href.split('#')[0]?.split('?')[0] ?? '';
  const normalised = path === '' ? '/' : path.replace(/\/$/, '') || '/';

  return ROUTES.has(normalised) ? { href: normalised as Href } : null;
}
