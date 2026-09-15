/**
 * Choosing which copy of an image to download.
 *
 * The website ships pre-scaled variants beside every asset — `hero-bg.png` sits
 * next to `hero-bg-512.png`, `hero-bg-1024.png` — and lists the available sizes
 * in `SiteImage.widths`. Getting the choice right is the difference between a
 * 2400px hero downloaded onto a 390pt screen and a 1024px one, which on a
 * mobile connection is most of the time-to-first-paint.
 *
 * The arithmetic lives in image-math.ts so it can be tested under plain Node;
 * this module is the thin part that needs React Native and the API host.
 */

import { PixelRatio } from 'react-native';

import { apiBaseUrl } from './api';
import type { SiteImage } from './content-types';
import { pickVariant, variantSrc } from './image-math';

export { contentPositionFor } from './image-math';

/** `/images/home/hero-bg.png` → `https://host/images/home/hero-bg.png`. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${apiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * The best variant for a given on-screen width.
 *
 * `getPixelSizeForLayoutSize` converts points to physical pixels, so a 3×
 * display asks for a larger file than a 2× one at the same layout size — which
 * is the entire reason the variants exist.
 */
export function imageUrl(image: SiteImage, displayWidth: number): string {
  const neededPx = PixelRatio.getPixelSizeForLayoutSize(displayWidth);
  const chosen = pickVariant(image.widths, image.width, image.height, neededPx);
  return absoluteUrl(chosen === null ? image.src : variantSrc(image.src, chosen));
}
