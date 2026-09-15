import type { Metadata } from 'next';
import { SiteShell } from '@/components/layout/SiteShell';
import { ContactBanner } from '@/components/contact/ContactBanner';
import { LocationSection } from '@/components/contact/LocationSection';
import { ContactFaq } from '@/components/contact/ContactFaq';
import { AccessRequestSection } from '@/components/contact/AccessRequestSection';
import { Footer } from '@/components/layout/Footer';
import { LAYOUT_HASHES } from '@/lib/breakpoints';
import { turnstileSiteKey } from '@/lib/turnstile';

export const metadata: Metadata = {
  title: 'Contact SXCCAA',
  description: 'Get in touch with the St. Xavier\'s College Calcutta Alumni Association. Reach out for questions about the alumni directory, events, chapters, or Association initiatives.',
};

/**
 * Dynamic because the Turnstile site key is read at request time.
 */
export const dynamic = 'force-dynamic';

export default function ContactPage() {
  return (
    <SiteShell
      rootClass="framer-tVDMH framer-50zb47"
      headerContainerClass="framer-4kmgod-container"
      lightPage
      spacerClass="framer-11ppgcl"
      footer={<Footer hashes={LAYOUT_HASHES.contact} containerClass="framer-pis4pp-container" />}
    >
      <div className="ct">
        <ContactBanner />
        <AccessRequestSection siteKey={turnstileSiteKey()} />
        <ContactFaq />
        <LocationSection />
      </div>
    </SiteShell>
  );
}
