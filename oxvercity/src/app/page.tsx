import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { Preloader } from '@/components/home/Preloader';
import { EventsUpcoming } from '@/components/events/EventsUpcoming';
import { AboutSection } from '@/components/home/AboutSection';
import { FacultySection } from '@/components/home/FacultySection';
import { ProgramSection } from '@/components/home/ProgramSection';

/**
 * The page opens on the one thing a visitor can still act on — the next event —
 * rather than on the College photograph. `EventsUpcoming` is the same component
 * /events opens on, rendered here as well: both pages show the same stage.
 *
 * It has to sit inside `.ev-page`. That class, not `.ev-stage`, carries the
 * `--ev-ease` and `--ev-out` easings the stage's animations read, along with
 * the eyebrow's colour and the Instrument Sans stack. Outside it the section
 * still renders, but every transition falls back to the browser's default
 * timing and the type goes wrong.
 *
 * The stage brings the page's `#scroll-trigger` with it, as `Hero` used to, and
 * is dark, so the header keeps its white-over-dark opening state and flips
 * solid on the first scroll exactly as before.
 */
export default function HomePage() {
  return (
    <SiteShell>
      <div className="framer-MS5lx framer-EpkeD framer-H9bCC framer-f9Co9 framer-PSLVr framer-GKtVI framer-72rtr7" data-framer-root="" style={PAGE_ROOT_STYLE}>
        <Preloader />
        <div className="ev-page">
          <EventsUpcoming headingLevel="h1" />
        </div>
        <div className="framer-18qsyp8" data-framer-name="Section Wrapper">
          <AboutSection />
          <FacultySection />
          <ProgramSection />
        </div>
      </div>
    </SiteShell>
  );
}
