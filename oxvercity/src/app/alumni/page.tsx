/**
 * /alumni — the directory.
 *
 * Open to everyone, at two different depths. The page resolves the viewer's
 * tier once, here, and hands the result down: the loader decides which fields
 * to send, and the components have no way to ask for more.
 *
 * `force-dynamic` is not optional. This page varies by who is asking, and a
 * statically generated or CDN-cached copy of it would be one viewer's version
 * served to everybody — which, on a page whose whole job is to show different
 * things to different people, is the failure mode. Pairing it with
 * `Cache-Control: private, no-store` in middleware covers the shared proxies
 * that do not read Next's hints.
 */

import type { Metadata } from 'next';

import { SiteShell } from '@/components/layout/SiteShell';
import { AlumniHero } from '@/components/alumni/AlumniHero';
import { AlumniFeatured } from '@/components/alumni/AlumniFeatured';
import { AlumniDiscover } from '@/components/alumni/AlumniDiscover';
import { SignInPrompt } from '@/components/alumni/SignInPrompt';
import { featuredIds } from '@/data/alumni';
import { listFeatured, listPublicAlumni, tierOf, servingDemoRecords } from '@/lib/directory';
import { currentSession } from '@/lib/session-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Alumni Directory — SXCCAA',
  description:
    'Reconnect with Xaverians across generations. Search the alumni directory, discover featured Xaverians, and connect with the global network.',
};

export default async function AlumniPage() {
  const viewer = tierOf(await currentSession());
  const isVerified = viewer === 'verified';
  const isDemo = servingDemoRecords();

  const people = await listPublicAlumni(viewer);
  const featured = await listFeatured(viewer, featuredIds);

  // Counted from what is on the page, so the figures can never overstate the
  // directory — see the note in AlumniHero.
  const stats = {
    total: people.length,
    batches: new Set(people.map((person) => person.batchYear)).size,
    streams: new Set(people.map((person) => person.stream).filter(Boolean)).size,
  };

  return (
    <SiteShell lightPage={true}>
      <div className="al-page">
        <AlumniHero stats={stats} />
        <AlumniFeatured people={featured} isDemo={isDemo} />
        {!isVerified && <SignInPrompt />}
        <AlumniDiscover people={people} isVerified={isVerified} isDemo={isDemo} />
      </div>
    </SiteShell>
  );
}
