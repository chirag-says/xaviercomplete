/**
 * The arithmetic behind picking an image variant, kept free of React Native.
 *
 * Split out from images.ts so it can be driven by `npm test` under plain Node.
 * The rules here are subtle enough to be worth testing and invisible enough to
 * break silently: a wrong variant is not an error, it is just a blurry
 * photograph or a wasted two megabytes, and neither shows up in a typecheck.
 */

import type { ImageContentPosition } from 'expo-image';

import type { SiteImage } from './content-types';

/**
 * `a/b-c.png` + 512 → `a/b-c-512.png`.
 *
 * The guard rejects a filename with no extension, and — more importantly — one
 * whose only dot is in a directory name (`/v1.2/photo`), where appending before
 * that dot would produce a path that does not exist.
 */
export function variantSrc(src: string, size: number): string {
  const dot = src.lastIndexOf('.');
  if (dot <= src.lastIndexOf('/')) return src;
  return `${src.slice(0, dot)}-${size}${src.slice(dot)}`;
}

/**
 * Which pre-scaled variant to request, or null for the original.
 *
 * The subtlety is that Framer's numeric suffix names the **longest side**, not
 * the width — documented in oxvercity/src/lib/images.ts. For a landscape image
 * those are the same thing. For a portrait they are not: a 512-suffixed
 * portrait is 512 *tall*, and therefore narrower than 512. Asking for a 512
 * variant to fill 512 pixels of width would fetch an image that then has to be
 * upscaled, which is exactly the blurriness this is meant to avoid.
 *
 * So the needed width is converted to a needed longest-side first, and the
 * smallest variant at or above it wins. When every variant is too small the
 * original is used rather than upscaling a small one.
 */
export function pickVariant(
  widths: number[] | undefined,
  imageWidth: number,
  imageHeight: number,
  neededPx: number,
): number | null {
  if (!widths || widths.length === 0) return null;
  if (!Number.isFinite(neededPx) || neededPx <= 0) return null;
  if (imageWidth <= 0) return null;

  const longest = Math.max(imageWidth, imageHeight);
  const neededLongest = neededPx * (longest / imageWidth);

  const ascending = [...widths].sort((a, b) => a - b);
  return ascending.find((size) => size >= neededLongest) ?? null;
}

/**
 * Translate the website's CSS `object-position` into expo-image's equivalent.
 *
 * Every value in src/data is a percentage pair — `'50% 38%'`, `'59.4% 15.1%'` —
 * which CSS reads as `left top`. expo-image wants named edges rather than a CSS
 * shorthand string, so the shorthand has to be split.
 *
 * This matters more than it looks. These values exist because someone framed a
 * photograph deliberately: `'50% 62%'` keeps a face out of the crop. Dropping
 * the prop and letting everything centre would silently re-crop several images
 * — the kind of regression nobody files and everybody notices.
 *
 * Anything that is not a percentage pair returns undefined, so expo-image falls
 * back to its own centre default rather than being handed a value its types
 * reject.
 */
export function contentPositionFor(image: SiteImage): ImageContentPosition | undefined {
  const raw = image.position?.trim();
  if (!raw) return undefined;

  const parts = raw.split(/\s+/);
  if (parts.length !== 2) return undefined;

  const [left, top] = parts;
  if (!left?.endsWith('%') || !top?.endsWith('%')) return undefined;
  if (!Number.isFinite(Number.parseFloat(left)) || !Number.isFinite(Number.parseFloat(top))) return undefined;

  return { left: left as `${number}%`, top: top as `${number}%` };
}
