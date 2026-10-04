import { nostalgia } from './nostalgia';
import { galleryPhotos } from './galleryPhotos';

/**
 * /gallery — the photographs SXCCAA has shared from its events.
 *
 * Today that is one event. Every photograph in the folder was taken at
 * Nostalgia ’26 cum Shakti: the stage banners in the frames carry its name, and
 * the camera's own timestamps all fall on 3 October 2026 — the date the posters
 * give. So the title, date and venue come from `nostalgia.ts` rather than being
 * restated, and no photograph is described beyond what that record says.
 */

export interface GalleryPhoto {
  /** Cloudinary public_id. */
  id: string;
  width: number;
  height: number;
  alt: string;
}

export const galleryEvent = {
  title: nostalgia.titlePlain,
  date: nostalgia.date,
  place: `${nostalgia.venue}, ${nostalgia.city}`,
};

export const galleryPage = {
  title: 'Gallery',
  intro: `Photographs from ${galleryEvent.title}, held at ${galleryEvent.place} on ${galleryEvent.date}.`,
};

export const photos: GalleryPhoto[] = galleryPhotos.map(([file, width, height], i) => ({
  id: `oxvercity/gallery/${file}`,
  width,
  height,
  alt: `${galleryEvent.title}, ${galleryEvent.date} — photograph ${i + 1}`,
}));
