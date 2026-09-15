/**
 * Images live under /public/images with one full-size file and optional
 * scaled variants that share its name with a `-<width>` suffix:
 *   /images/home/hero-bg.png, /images/home/hero-bg-512.png, hero-bg-1024.png…
 *
 * A data file names the full-size file and its intrinsic size; the variants
 * that exist are listed in `widths` so the srcset can be built. To replace an
 * image, drop in a new file of the same name (and either regenerate the
 * variants or set `widths: []`, which serves the one file everywhere).
 */
export interface SiteImage {
  src: string;
  /** Intrinsic pixel size of the full-size file. */
  width: number;
  height: number;
  /** Widths of the scaled variants next to the file, smallest first. */
  widths?: number[];
  alt: string;
  /** CSS `object-position` for the crop, when not centred. */
  position?: string;
}

/**
 * The `-<size>` suffix names the variant's longest side, as Framer's CDN
 * scales images. Landscape files are as wide as their suffix; a portrait
 * variant's real width is the suffix scaled by the aspect ratio, and that is
 * what the srcset descriptor must say.
 */
export function imageSrcSet({ src, width, height, widths = [] }: SiteImage): string | undefined {
  if (widths.length === 0) return undefined;
  const dot = src.lastIndexOf('.');
  const base = src.slice(0, dot);
  const ext = src.slice(dot);
  const ratio = Math.min(1, width / height);
  return [...widths.map((size) => `${base}-${size}${ext} ${Math.floor(size * ratio)}w`), `${src} ${width}w`].join(', ');
}
