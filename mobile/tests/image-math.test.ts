/**
 * The variant-picking rules.
 *
 *   npm test
 *
 * Worth testing because every failure mode here is silent. A variant that is too
 * small is a blurry photograph; one that is too large is two wasted megabytes on
 * a mobile connection; a mangled filename is a broken image. None of the three
 * fails a typecheck, and none throws.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contentPositionFor, pickVariant, variantSrc } from '../lib/image-math.ts';
import type { SiteImage } from '../lib/content-types.ts';

const WIDTHS = [512, 1024, 2048];

describe('variantSrc', () => {
  it('inserts the size before the extension', () => {
    assert.equal(variantSrc('/images/home/hero-bg.png', 512), '/images/home/hero-bg-512.png');
  });

  it('leaves a path with no extension alone', () => {
    assert.equal(variantSrc('/images/home/hero-bg', 512), '/images/home/hero-bg');
  });

  it('is not fooled by a dot in a directory name', () => {
    // Appending before that dot would name a file that does not exist.
    assert.equal(variantSrc('/assets/v1.2/photo', 512), '/assets/v1.2/photo');
  });

  it('handles a filename with several dots', () => {
    assert.equal(variantSrc('/img/a.b.c.jpg', 1024), '/img/a.b.c-1024.jpg');
  });
});

describe('pickVariant — landscape', () => {
  // 2000x1000: the longest side is the width, so suffix == width.
  const w = 2000;
  const h = 1000;

  it('picks the smallest variant that covers the need', () => {
    assert.equal(pickVariant(WIDTHS, w, h, 500), 512);
    assert.equal(pickVariant(WIDTHS, w, h, 513), 1024);
  });

  it('takes an exact match rather than the next size up', () => {
    assert.equal(pickVariant(WIDTHS, w, h, 512), 512);
  });

  it('falls back to the original when every variant is too small', () => {
    assert.equal(pickVariant(WIDTHS, w, h, 4000), null);
  });

  it('does not care what order the widths arrive in', () => {
    assert.equal(pickVariant([2048, 512, 1024], w, h, 500), 512);
  });
});

describe('pickVariant — portrait', () => {
  /*
   * The case the whole function exists for. 1000x2000: the suffix names the
   * *height*, so a 512 variant is only 256 wide. Filling 500 pixels of width
   * therefore needs the 1024 variant, not the 512 one — a naive
   * `widths.find(x => x >= needed)` would pick 512 and render it blurry.
   */
  const w = 1000;
  const h = 2000;

  it('accounts for the suffix naming the longest side', () => {
    assert.equal(pickVariant(WIDTHS, w, h, 500), 1024);
  });

  it('still picks the smallest sufficient variant', () => {
    assert.equal(pickVariant(WIDTHS, w, h, 200), 512);
  });

  it('needs a bigger file than the same request on a landscape image', () => {
    const portrait = pickVariant(WIDTHS, 1000, 2000, 500);
    const landscape = pickVariant(WIDTHS, 2000, 1000, 500);
    assert.ok(portrait !== null && landscape !== null && portrait > landscape);
  });
});

describe('pickVariant — degenerate input', () => {
  it('returns null when there are no variants', () => {
    assert.equal(pickVariant(undefined, 2000, 1000, 500), null);
    assert.equal(pickVariant([], 2000, 1000, 500), null);
  });

  it('returns null for a zero or negative need', () => {
    assert.equal(pickVariant(WIDTHS, 2000, 1000, 0), null);
    assert.equal(pickVariant(WIDTHS, 2000, 1000, -100), null);
  });

  it('returns null rather than dividing by a zero width', () => {
    assert.equal(pickVariant(WIDTHS, 0, 1000, 500), null);
  });

  it('returns null for a non-finite need', () => {
    assert.equal(pickVariant(WIDTHS, 2000, 1000, Number.NaN), null);
  });
});

describe('contentPositionFor', () => {
  const image = (position?: string): SiteImage => ({
    src: '/x.png',
    width: 100,
    height: 100,
    alt: '',
    ...(position === undefined ? {} : { position }),
  });

  it('splits a CSS percentage pair into left and top', () => {
    // CSS object-position reads as "left top", so 50% is left and 38% is top.
    assert.deepEqual(contentPositionFor(image('50% 38%')), { left: '50%', top: '38%' });
  });

  it('handles fractional percentages, which the real data contains', () => {
    assert.deepEqual(contentPositionFor(image('59.4% 15.1%')), { left: '59.4%', top: '15.1%' });
  });

  it('tolerates extra whitespace', () => {
    assert.deepEqual(contentPositionFor(image('  50%   62%  ')), { left: '50%', top: '62%' });
  });

  it('returns undefined when unset, so expo-image centres by default', () => {
    assert.equal(contentPositionFor(image()), undefined);
    assert.equal(contentPositionFor(image('')), undefined);
  });

  it('refuses keywords and single values rather than passing them through', () => {
    assert.equal(contentPositionFor(image('center')), undefined);
    assert.equal(contentPositionFor(image('50%')), undefined);
    assert.equal(contentPositionFor(image('top left')), undefined);
  });

  it('refuses pixel values — expo-image would take them as literal pixels', () => {
    assert.equal(contentPositionFor(image('50px 38px')), undefined);
  });

  it('refuses a percentage that is not a number', () => {
    assert.equal(contentPositionFor(image('abc% def%')), undefined);
  });
});

describe('the real values from the website', () => {
  // Every object-position in oxvercity/src/data, so a future edit that
  // introduces a keyword or a pixel value is caught here rather than on a phone.
  const REAL = ['50% 38%', '50% 52%', '50% 62%', '59.4% 15.1%'];

  it('all parse', () => {
    for (const position of REAL) {
      const parsed = contentPositionFor({ src: '/x.png', width: 1, height: 1, alt: '', position });
      assert.ok(parsed, `${position} should parse`);
    }
  });
});
