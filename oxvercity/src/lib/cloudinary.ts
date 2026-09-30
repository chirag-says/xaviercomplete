/**
 * Cloudinary URL helpers.
 *
 * Every image that was under `/public/images/` is now served from Cloudinary.
 * The upload script placed them at `oxvercity/<subpath>` — for instance,
 * `/images/home/hero-bg.jpg` lives at public_id `oxvercity/home/hero-bg`.
 *
 * The helpers here turn a local path like `/images/home/hero-bg.jpg` into a
 * Cloudinary delivery URL with automatic format (WebP / AVIF), automatic
 * quality, and optional width scaling — which means the scaled `-512`, `-1024`
 * etc. variants that were baked as separate files are no longer needed; one
 * upload + one URL parameter replaces them all.
 */

const CLOUD_NAME = 'l7gcfbfi';

/**
 * Build a Cloudinary delivery URL from a local `/images/…` path.
 *
 * @param localPath  The original path, e.g. `/images/home/hero-bg.jpg`
 * @param opts.width Optional pixel width to resize to (height scales proportionally).
 * @returns          A full `https://res.cloudinary.com/…` URL.
 */
export function cloudinaryUrl(localPath: string, opts?: { width?: number }): string {
  // Strip leading `/images/` to get the relative subpath
  const stripped = localPath.replace(/^\/images\//, '');
  const parts = stripped.split('/');
  const filename = parts.pop()!;
  const subfolders = parts; // e.g. ['events'] or ['home'] or []
  const folder = ['oxvercity', ...subfolders].join('/');       // oxvercity/events
  const [, basename, ext] = filename.match(/^(.*)(\.[^.]+)$/) || [, filename, ''];
  // The upload stored at folder + "/" + folder + "/" + basename
  // because both `folder` and `public_id` (which included folder) were sent.
  const fullPath = `${folder}/${folder}/${basename}${ext}`;

  const transforms = ['f_auto', 'q_auto'];
  if (opts?.width) transforms.push(`w_${opts.width}`);

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transforms.join(',')}/${fullPath}`;
}

/**
 * Build a Cloudinary srcSet string from a local path and a set of widths.
 *
 * Cloudinary's on-the-fly resize replaces the baked `-512`, `-1024` variants.
 * Each entry uses `f_auto,q_auto,w_<width>` so the browser gets the smallest
 * adequate file in the best format it supports.
 *
 * The full-size image (no `w_` transform) is appended with its intrinsic width
 * as the descriptor, matching how the previous local srcSet worked.
 *
 * @param localPath      The original base path, e.g. `/images/home/hero-bg.jpg`
 * @param intrinsicWidth The pixel width of the full-size upload.
 * @param widths         The scaled widths to include (smallest first).
 */
export function cloudinarySrcSet(
  localPath: string,
  intrinsicWidth: number,
  widths: number[],
): string | undefined {
  if (widths.length === 0) return undefined;

  const entries = widths.map(
    (w) => `${cloudinaryUrl(localPath, { width: w })} ${w}w`,
  );
  // Append the full-size image
  entries.push(`${cloudinaryUrl(localPath)} ${intrinsicWidth}w`);
  return entries.join(', ');
}
