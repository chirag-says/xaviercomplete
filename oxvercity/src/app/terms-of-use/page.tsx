import type { Metadata } from 'next';
import { SiteShell, PAGE_ROOT_STYLE } from '@/components/layout/SiteShell';
import { PolicyPlaceholder } from '@/components/shared/PolicyPlaceholder';
// Moved to src/data so the mobile app can render the same words through
// /api/app/v1/content rather than keeping a second copy that drifts. The output
// of this page is unchanged.
import { termsOfUse } from '@/data/pages/policies';

export const metadata: Metadata = { title: 'Terms of Use — SXCCAA' };

export default function TermsOfUsePage() {
  return (
    <SiteShell lightPage>
      <div className="framer-OAXg4 framer-EpkeD framer-H9bCC framer-1ijzfe8" data-framer-root="" style={PAGE_ROOT_STYLE}>
        <PolicyPlaceholder
          title={termsOfUse.title}
          intro={termsOfUse.intro}
          points={termsOfUse.points}
        />
        {/* The header's scroll variant keys off this 1px strip, as on every
        other page; the banner used to carry it. */}
        <div aria-label="Scroll Trigger" className="framer-fkc7tz" data-framer-name="Scroll Triger" id="scroll-trigger" />
      </div>
    </SiteShell>
  );
}
