import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { Preloader } from '@/components/home/Preloader';
import { NostalgiaHero } from '@/components/home/nostalgia/NostalgiaHero';
import { AwardeeSpotlight } from '@/components/home/nostalgia/AwardeeSpotlight';
import { BookingSection } from '@/components/home/nostalgia/BookingSection';
import { Pillars } from '@/components/home/nostalgia/Pillars';
import { AboutSection } from '@/components/home/AboutSection';
import { FacultySection } from '@/components/home/FacultySection';
import { ProgramSection } from '@/components/home/ProgramSection';

/**
 * The page opens on the invitation to Nostalgia '26 — its own landing, built
 * from the two posters SXCCAA supplied, and no longer the `EventsUpcoming`
 * stage /events opens on. The two pages were showing the same first screen;
 * /events keeps that stage untouched, and this is the home page's own.
 *
 * The run is four beats, alternating ground so each one lands separately. The
 * hero deliberately does not use the invitation poster's own plum: the /events
 * stage is built from exactly that, and the two pages were opening on the same
 * screen. See the note at the top of `NostalgiaHero`.
 *
 *   NostalgiaHero     the invitation poster on champagne, unframed and given
 *                     the wider column: the title, a live countdown and the
 *                     date beside it. Carries the page's h1 and the 1px
 *                     `#scroll-trigger` the fixed header reads. The hero is
 *                     light, so the shell is marked `lightPage` and the bar
 *                     opens with ink type instead of white; the trigger still
 *                     flips it solid on the first scroll.
 *   AwardeeSpotlight  the awardee poster on its ivory: Monali Thakur, and the
 *                     SHAKTI block printed beside her.
 *   BookingSection    the booking ladder and the bank account, back on ink.
 *   Pillars           the invitation's pull-quote and triptych, on white.
 *
 * Below them the College's own sections continue unchanged. A reader who came
 * for the event has everything they need above `AboutSection`; a reader who
 * came for the Association carries on from there.
 */
export default function HomePage() {
  return (
    <SiteShell lightPage>
      <div className="framer-MS5lx framer-EpkeD framer-H9bCC framer-f9Co9 framer-PSLVr framer-GKtVI framer-72rtr7" data-framer-root="" style={PAGE_ROOT_STYLE}>
        <Preloader />
        {/* `.nos-run` carries the tokens, the type stack and the easings every
            section below reads — outside it they fall back to the browser's. */}
        <div className="nos-run">
          <NostalgiaHero />
          <AwardeeSpotlight />
          <BookingSection />
          <Pillars />
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
