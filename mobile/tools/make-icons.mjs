/**
 * Generate the Android launcher and splash artwork from the College crest.
 *
 *   node tools/make-icons.mjs
 *
 * Committed as a script rather than hand-made in an image editor so the assets
 * are reproducible: if the crest is ever replaced, re-run this and every size
 * regenerates consistently.
 *
 * ## Where the source comes from
 *
 * `oxvercity/public/svg/logo-crest.svg` is not really a vector — it is an SVG
 * wrapper around a base64 PNG. So this reads the PNG straight out of the SVG
 * rather than rasterising, which avoids a needless re-encode and keeps whatever
 * transparency the original has.
 *
 * ## The three outputs, and why their padding differs
 *
 * **icon.png** — the square icon. The crest sits on the Association's ink at
 * about 62% of the canvas. Full-bleed would put the crest's edges hard against
 * the icon's, which reads as cramped at 48dp on a home screen.
 *
 * **adaptive-icon.png** — Android's foreground layer, and the one with a real
 * constraint. Android composites this over `adaptiveIcon.backgroundColor` and
 * then masks the result to whatever shape the launcher uses — circle, squircle,
 * teardrop, rounded square. Only the central **66%** is guaranteed to survive
 * that mask, and the outer ring is additionally used for the parallax wobble on
 * some launchers. So the crest is held inside ~50% of the canvas, and the layer
 * is transparent rather than filled.
 *
 * **splash.png** — shown while the app loads. Transparent, because app.json sets
 * the background colour; baking the colour in makes a visible seam if the two
 * ever drift apart.
 */

import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CREST_SVG = path.resolve(HERE, '../../oxvercity/public/svg/logo-crest.svg');
const OUT = path.resolve(HERE, '../assets');

/** The Association's ink, from oxvercity/src/lib/tokens.ts. */
const INK = { r: 0x11, g: 0x11, b: 0x11, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const CANVAS = 1024;

/** Pull the embedded PNG out of the SVG wrapper. */
async function crestPng() {
  const svg = await readFile(CREST_SVG, 'utf8');
  const match = /href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/.exec(svg);
  if (!match) {
    throw new Error(`No embedded PNG found in ${CREST_SVG}. Was the crest replaced with a real vector?`);
  }
  return Buffer.from(match[1], 'base64');
}

/**
 * Crest centred on a canvas, scaled so its longest side is `fraction` of it.
 *
 * `fit: 'inside'` preserves the crest's 134×160 portrait aspect — squashing a
 * coat of arms to fill a square would be worse than any amount of padding.
 */
async function compose(crest, { fraction, background }) {
  const target = Math.round(CANVAS * fraction);

  const scaled = await sharp(crest)
    .resize(target, target, { fit: 'inside', background: TRANSPARENT })
    .png()
    .toBuffer();

  return sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background },
  })
    .composite([{ input: scaled, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function main() {
  const crest = await crestPng();
  await mkdir(OUT, { recursive: true });

  const outputs = [
    // Square launcher icon and Play Store listing art.
    ['icon.png', { fraction: 0.62, background: INK }],
    // Android adaptive foreground: inside the 66% safe zone, transparent.
    ['adaptive-icon.png', { fraction: 0.5, background: TRANSPARENT }],
    // Splash artwork; app.json supplies the colour behind it.
    ['splash.png', { fraction: 0.4, background: TRANSPARENT }],
    // Play Console also wants a plain 512 icon; same art, smaller.
    ['icon-512.png', { fraction: 0.62, background: INK }],
  ];

  for (const [name, options] of outputs) {
    const png = await compose(crest, options);
    const file = path.join(OUT, name);

    // The 512 variant is the only one that is not 1024.
    const final = name === 'icon-512.png' ? await sharp(png).resize(512, 512).png().toBuffer() : png;

    await writeFile(file, final);
    const { width, height, channels } = await sharp(final).metadata();
    process.stdout.write(`  ${name.padEnd(20)} ${width}×${height}, ${channels} channels\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
