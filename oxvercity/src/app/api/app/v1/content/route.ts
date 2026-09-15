/**
 * GET /api/app/v1/content — every word and picture the app renders.
 *
 * ## Why the app fetches its copy instead of shipping it
 *
 * The website's content is fourteen static TypeScript modules under src/data.
 * The obvious move is to share them with the app through a monorepo package —
 * and it is the wrong one. Bundled copy means a typo in the About page needs a
 * new binary, a store review, and every alumnus to update before they see the
 * fix. That is a fortnight to correct a comma.
 *
 * So the app asks the server, caches the answer to disk, and revalidates with
 * `If-None-Match`. Editing src/data and deploying reaches every installed app on
 * next launch. The website and the app read the same modules, so they cannot
 * drift, and there is no package to extract or keep in step.
 *
 * ## What is not in here
 *
 * - **`demoAlumni`.** src/data/alumni.ts exports twelve synthetic records
 *   alongside the directory copy. Only the copy is imported below. Alumni data
 *   reaches the app through the directory endpoints, which apply the viewer
 *   tier; it must never arrive as part of a publicly cacheable content blob.
 *   `npm run app:verify` asserts the payload contains no synthetic record.
 * - **`effects`, `appear`, `scrollTransforms`.** Five thousand lines of
 *   Framer motion specs keyed to CSS class names that will not exist in React
 *   Native. Reanimated transitions are written natively.
 * - **`news`** from about.ts. Exported, but no page imports `NewsSection` — it
 *   is not on the website, so it is not in the app.
 * - **`searchIndex`.** Roughly forty kilobytes on every content fetch for a
 *   screen deferred past 1.0. It joins the payload when search ships.
 *
 * ## Public caching, and why that is safe here
 *
 * `Cache-Control: public` on an endpoint is how per-user data ends up in a
 * shared cache. It is correct here only because every byte is already public —
 * the same words any anonymous visitor reads on the website. Nothing in this
 * response varies by caller, so there is nothing to leak. If that ever stops
 * being true, the header has to change in the same commit.
 */

import { createHash } from 'node:crypto';

import { NextResponse } from 'next/server';

import { exploreDetailsLabel, exploreItems } from '@/data/explore';
import {
  aboutCard,
  bannerLead,
  college,
  facts,
  history,
  pillars,
  pillarsHeading,
  statLines,
  why,
} from '@/data/pages/about';
import {
  alumniEvents,
  eventsPage,
  featuredEvent,
  gallery,
  leadEventId,
  storyEventIds,
  strands,
  upcomingEvent,
} from '@/data/pages/events';
import {
  billSection,
  chaptersPage,
  closing,
  joinSection,
  meetsSection,
  network,
  westZone,
} from '@/data/pages/chapters';
import { contactPage, faq } from '@/data/pages/contact';
import { campusCards, faculties, hero, homeAbout } from '@/data/pages/home';
import { privacyPolicy, termsOfUse } from '@/data/pages/policies';
import { searchPage } from '@/data/pages/search';
import {
  associationName,
  associationShortName,
  contact,
  contactCta,
  eventsCta,
  footerColumns,
  headerCta,
  mainNav,
  mobileMenu,
  motto,
  pagesMenu,
  pagesMenuLabel,
  siteLogo,
  siteName,
} from '@/data/site';
// Copy only. The synthetic records in this module are deliberately not imported.
import { directoryCopy, filterLabels } from '@/data/alumni';
import { voices } from '@/data/voices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildBundle() {
  return {
    site: {
      logo: siteLogo,
      name: siteName,
      associationName,
      associationShortName,
      motto,
      contact,
    },
    nav: {
      main: mainNav,
      pagesMenuLabel,
      pagesMenu,
      mobile: mobileMenu,
      headerCta,
      eventsCta,
      footerColumns,
    },
    home: { hero, faculties, campusCards, voices, about: homeAbout },
    about: {
      bannerLead,
      card: aboutCard,
      pillars,
      pillarsHeading,
      history,
      why,
      college,
      facts,
      statLines,
    },
    events: {
      page: eventsPage,
      strands,
      upcoming: upcomingEvent,
      featured: featuredEvent,
      all: alumniEvents,
      leadEventId,
      storyEventIds,
      gallery,
    },
    chapters: {
      westZone,
      page: chaptersPage,
      network,
      meetsSection,
      billSection,
      joinSection,
      closing,
    },
    explore: { detailsLabel: exploreDetailsLabel, items: exploreItems },
    contact: { page: contactPage, faq, cta: contactCta },
    directory: { copy: directoryCopy, filterLabels },
    search: { page: searchPage },
    /*
     * The same words the website's own /privacy-policy and /terms-of-use render
     * — both surfaces import src/data/pages/policies.ts, so there is one source
     * rather than a copy in the app that drifts the first time one is edited.
     *
     * These are the Association's provisional notices, not its legal wording;
     * each document says so itself in `notice`, and the app shows that notice
     * verbatim rather than paraphrasing it.
     */
    policies: { privacy: privacyPolicy, terms: termsOfUse },
  };
}

/**
 * Serialised once per process, not once per request.
 *
 * The payload is built from static imports, so it cannot change while the
 * process lives. Re-stringifying and re-hashing roughly a hundred kilobytes on
 * every launch of every app would be pure waste.
 *
 * The ETag is a hash of the body and **contains no timestamp**. A generation
 * time in here would change the hash on every deploy-identical restart, so every
 * app would re-download an unchanged bundle — which is the opposite of the point.
 */
let cached: { body: string; etag: string } | undefined;

function bundle(): { body: string; etag: string } {
  if (!cached) {
    const body = JSON.stringify(buildBundle());
    const etag = `"${createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 32)}"`;
    cached = { body, etag };
  }
  return cached;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { body, etag } = bundle();

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    // Five minutes of shared caching, then revalidate. Content edits reach an
    // app on next launch; they do not need to be instant, and a stampede of
    // launches after a broadcast should not each hit the origin.
    'Cache-Control': 'public, max-age=300',
    ETag: etag,
  };

  /*
   * `If-None-Match` may carry several tags, and a proxy is allowed to weaken a
   * strong tag to `W/"…"`. Matching on inclusion rather than equality keeps the
   * 304 working through a CDN instead of silently re-sending the whole bundle
   * every launch.
   */
  const inm = request.headers.get('if-none-match');
  if (inm && inm.split(',').some((candidate) => candidate.trim().replace(/^W\//, '') === etag)) {
    return new NextResponse(null, { status: 304, headers }) as NextResponse;
  }

  return new NextResponse(body, { status: 200, headers }) as NextResponse;
}
