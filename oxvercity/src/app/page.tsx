import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { Preloader } from '@/components/home/Preloader';
import { Hero } from '@/components/home/Hero';
import { AboutSection } from '@/components/home/AboutSection';
import { FacultySection } from '@/components/home/FacultySection';
import { ProgramSection } from '@/components/home/ProgramSection';
import { CampusSection } from '@/components/home/CampusSection';
import { VoicesSection } from '@/components/home/VoicesSection';

export default function HomePage() {
  return (
    <SiteShell>
      <div className="framer-MS5lx framer-EpkeD framer-H9bCC framer-f9Co9 framer-PSLVr framer-GKtVI framer-72rtr7" data-framer-root="" style={PAGE_ROOT_STYLE}>
        <Preloader />
        <Hero />
        <div className="framer-18qsyp8" data-framer-name="Section Wrapper">
          <AboutSection />
          <FacultySection />
          <ProgramSection />
          <CampusSection />
          <VoicesSection />
        </div>
      </div>
    </SiteShell>
  );
}
