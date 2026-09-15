import type { Metadata } from 'next';
import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { AboutBanner } from '@/components/about/AboutBanner';
import { AboutStory } from '@/components/about/AboutStory';
import { PillarsSection } from '@/components/about/PillarsSection';
import { HistorySection } from '@/components/about/HistorySection';
import { WhySection } from '@/components/about/WhySection';
import { CollegeSection } from '@/components/about/CollegeSection';

export const metadata: Metadata = { title: 'About SXCCAA — St. Xavier\u2019s College Alumni Association' };

/**
 * The page opens with the Association, turns to the College it came out of —
 * what it stands for, where it came from, why it is what it is, and what it
 * asks of a Xaverian. There is no contact form: the footer already carries the
 * office address and the /contact page is one click away. One dark section, the
 * full-screen pillars, breaks the run of light ones in the middle.
 */
export default function AboutPage() {
  return (
    <SiteShell>
      <div className="framer-b52HK framer-EpkeD framer-H9bCC framer-PSLVr framer-GKtVI framer-hZdsH framer-lytYB framer-PG8vB framer-r0yflc" data-framer-root="" style={PAGE_ROOT_STYLE}>
        <AboutBanner />
        <div className="framer-1dyyrpu" data-framer-name="Section Wrapper">
          <AboutStory />
          <PillarsSection />
          <HistorySection />
          <WhySection />
          <CollegeSection />
        </div>
      </div>
    </SiteShell>
  );
}
