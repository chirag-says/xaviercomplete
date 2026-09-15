import type { Metadata } from 'next';
import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { ExploreBanner } from '@/components/explore/ExploreBanner';
import { ExploreList } from '@/components/explore/ExploreList';

export const metadata: Metadata = { title: 'Explore the Xaverian Network — SXCCAA' };

export default function ExplorePage() {
  return (
    <SiteShell>
      <div className="framer-OAXg4 framer-EpkeD framer-H9bCC framer-1ijzfe8" data-framer-root="" style={PAGE_ROOT_STYLE}>
        <ExploreBanner />
        <ExploreList />
      </div>
    </SiteShell>
  );
}
