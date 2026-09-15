import type { Metadata } from 'next';
import { SiteShell } from '@/components/layout/SiteShell';
import { EventsUpcoming } from '@/components/events/EventsUpcoming';
import { EventsHero } from '@/components/events/EventsHero';
import { EventsIndex } from '@/components/events/EventsIndex';
import { EventsStory } from '@/components/events/EventsStory';
import { EventsArchive } from '@/components/events/EventsArchive';
import { EventsGallery } from '@/components/events/EventsGallery';

export const metadata: Metadata = {
  title: 'Alumni Events & Activities — SXCCAA',
  description:
    "Initiatives, gatherings and championships run by the St. Xaviers College (Calcutta) Alumni Association and its forums, with the Association's own record of each.",
};

export default function EventsPage() {
  return (
    <SiteShell>
      <div className="ev-page">
        <EventsUpcoming />
        <EventsHero />
        <EventsIndex />
        <EventsStory />
        <EventsArchive />
        <EventsGallery />
      </div>
    </SiteShell>
  );
}
