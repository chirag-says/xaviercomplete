import type { Metadata } from 'next';
import { SiteShell } from '@/components/layout/SiteShell';
import { PhotoGallery } from '@/components/gallery/PhotoGallery';
import { galleryPage } from '@/data/pages/gallery';

export const metadata: Metadata = {
  title: 'Gallery — SXCCAA',
  description: galleryPage.intro,
};

export default function GalleryPage() {
  return (
    <SiteShell lightPage>
      <div className="ev-page gl-page">
        <div aria-label="Scroll Trigger" className="gl-trigger" id="scroll-trigger" />
        <PhotoGallery />
      </div>
    </SiteShell>
  );
}
