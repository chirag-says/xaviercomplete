/**
 * Which element each scroll-linked transform in `effects.ts` follows.
 *
 * Framer's "scroll transform" interpolates an element between its targets as a
 * reference layer travels through the viewport: the range starts when the
 * reference's top reaches `threshold × viewport height` and spans the
 * reference's own height (measured from the original site, matching the
 * runtime's `gl()` range function). The targets and springs are read from
 * the bundle into `effects.ts`; the reference layers are named here because
 * the bundle refers to them by React ref.
 *
 * `curve: 'half'` reproduces the hero zoom as measured on the original: the
 * background reaches half the configured 1.15 scale over the first half of
 * the hero (a rational easing, x / (1 + x), fitted to within 0.3%).
 * `length: 0` makes the range a switch (a trigger of a few pixels), which is
 * how the about page's three images pop in one after another.
 */
export interface ScrollTransformBinding {
  className: string;
  /** Selector of the reference layer, searched from the document. */
  ref: string;
  /** Added to the reference's document offset. */
  offset?: number;
  /** Overrides the reference's height as the range length. */
  length?: number;
  curve?: 'linear' | 'half';
}

export const scrollTransforms: ScrollTransformBinding[] = [
  { className: 'framer-1n96xeg-container', ref: '#hero', curve: 'half' },
  { className: 'framer-1tpa2o2-container', ref: '#banner', curve: 'half' },
  { className: 'framer-cfp9ri-container', ref: '#banner', curve: 'half' },
  { className: 'framer-1x3z8yx', ref: '#trigger' },
  { className: 'framer-akmuco', ref: '#trigger' },
  { className: 'framer-qoim7z', ref: '.framer-trsbl3', offset: 80, length: 1 },
];
