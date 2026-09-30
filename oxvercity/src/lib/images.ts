/**
 * Images are served from Cloudinary. Each image's `src` still records the
 * original `/images/…` path it was uploaded from — that path is the stable
 * identifier — and the helpers here turn it into a Cloudinary delivery URL.
 *
 * The baked `-512`, `-1024` etc. variants are no longer needed: Cloudinary
 * resizes on the fly from the one uploaded original.
 */

import { cloudinaryUrl, cloudinarySrcSet } from './cloudinary';

export { cloudinaryUrl } from './cloudinary';

export interface SiteImage {
  src: string;
  /** Intrinsic pixel size of the full-size file. */
  width: number;
  height: number;
  /** Widths of the scaled variants, smallest first. Cloudinary resizes on the fly. */
  widths?: number[];
  alt: string;
  /** CSS `object-position` for the crop, when not centred. */
  position?: string;
}

/**
 * Build a srcSet string from a SiteImage, using Cloudinary's on-the-fly
 * resizing instead of pre-baked file variants.
 *
 * The old logic appended `-<width>` to the filename and expected a physical
 * file at that path. Now each width becomes a `w_<width>` transform param.
 */
export function imageSrcSet({ src, width, widths = [] }: SiteImage): string | undefined {
  return cloudinarySrcSet(src, width, widths);
}

/**
 * Return the Cloudinary URL for a SiteImage's base (full-size) file.
 * Use this wherever a component needs a single `src` rather than a srcSet.
 */
export function imageUrl(image: SiteImage | string, opts?: { width?: number }): string {
  const src = typeof image === 'string' ? image : image.src;
  return cloudinaryUrl(src, opts);
}
