/**
 * Width classes, and why they are not round numbers.
 *
 * The plan requires the app to work on "all kinds of mobile layouts", which in
 * practice means four real populations rather than a designer's breakpoints:
 *
 *   compact  < 360dp   iPhone SE, Galaxy A-series, older budget Androids
 *   regular  360–413   iPhone 15/16, Pixel 8 — the bulk of real devices
 *   wide     414–599   Pro Max, Ultra
 *   tablet   >= 600    iPad, Galaxy Tab, an unfolded Fold
 *
 * The boundaries sit where devices actually sit. 360 is the floor for almost
 * every Android shipped since 2019; 414 is where Apple's Plus and Max sizes
 * begin; 600 is Android's own `sw600dp` tablet threshold.
 *
 * ## Measured, never inferred
 *
 * This reads width, not orientation. A landscape phone and a portrait tablet
 * can be the same width, and they should lay out the same way — so there is
 * deliberately no `isLandscape` here. A foldable that unfolds crosses from
 * `regular` to `tablet` mid-session and the layout follows, which is the whole
 * reason to measure rather than branch on a device flag at launch.
 *
 * `useWindowDimensions` re-renders on rotation, fold and split-screen resize, so
 * everything downstream is reactive for free.
 */

import { useWindowDimensions } from 'react-native';

export type WidthClass = 'compact' | 'regular' | 'wide' | 'tablet';

export function widthClassFor(width: number): WidthClass {
  if (width >= 600) return 'tablet';
  if (width >= 414) return 'wide';
  if (width >= 360) return 'regular';
  return 'compact';
}

export interface Layout {
  width: number;
  height: number;
  widthClass: WidthClass;
  /** Columns for the alumni directory and the event photo album. */
  columns: number;
  /** Horizontal page padding. Tablets get more so text lines do not run long. */
  gutter: number;
  /** True at >= 600dp, where two-pane and wider measures become reasonable. */
  isTablet: boolean;
}

const COLUMNS: Record<WidthClass, number> = {
  // One column under 360dp: two cards plus a gutter leaves ~160dp each, which
  // truncates most names and every employer.
  compact: 1,
  regular: 2,
  wide: 2,
  tablet: 4,
};

const GUTTER: Record<WidthClass, number> = { compact: 16, regular: 20, wide: 20, tablet: 32 };

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const widthClass = widthClassFor(width);

  return {
    width,
    height,
    widthClass,
    columns: COLUMNS[widthClass],
    gutter: GUTTER[widthClass],
    isTablet: widthClass === 'tablet',
  };
}
