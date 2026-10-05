import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { Preloader } from '@/components/home/Preloader';
import { Hero } from '@/components/home/Hero';
import { PodiumSection } from '@/components/home/PodiumSection';
import { AboutSection } from '@/components/home/AboutSection';
import { FacultySection } from '@/components/home/FacultySection';
import { ProgramSection } from '@/components/home/ProgramSection';

/**
 * The page opens on the full-height hero again — the College's name over the
 * College photograph — then the Secretary's photograph from Nostalgia '26
 * with a note under it, and the College's own sections follow. The Nostalgia
 * poster run that stood here for the event (`components/home/nostalgia/`) is
 * no longer mounted; /events still carries the event itself.
 */
export default function HomePage() {
  return (
    <SiteShell>
      <div className="framer-MS5lx framer-EpkeD framer-H9bCC framer-f9Co9 framer-PSLVr framer-GKtVI framer-72rtr7" data-framer-root="" style={PAGE_ROOT_STYLE}>
        <Preloader />
        <Hero />
        <div className="framer-18qsyp8" data-framer-name="Section Wrapper">
          <PodiumSection />
          <AboutSection />
          <FacultySection />
          <ProgramSection />
        </div>
      </div>
    </SiteShell>
  );
}
