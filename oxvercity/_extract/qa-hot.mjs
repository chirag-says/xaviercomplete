// Where do the diffs cluster? Prints the y-ranges with the most differing
// pixels and writes side-by-side crops (live | rebuild | diff) of them.
//   node exports/oxv/_work/qa-hot.mjs <name>-<width> [bands]
import fs from 'node:fs/promises';
import { PNG } from 'file:///D:/exporter/node_modules/pngjs/lib/png.js';
import sharp from 'sharp';
const key = process.argv[2];
const bands = Number(process.argv[3] || 3);
const DIR = 'D:/oxversity/_extract/qa';
const diff = PNG.sync.read(await fs.readFile(`${DIR}/${key}-diff.png`));
const rows = new Array(diff.height).fill(0);
for (let y = 0; y < diff.height; y++) for (let x = 0; x < diff.width; x++) { const i = (y * diff.width + x) * 4; if (diff.data[i] > 200 && diff.data[i + 1] < 100) rows[y]++; }
const BAND = 300;
const scores = [];
for (let y = 0; y < diff.height; y += BAND) scores.push([y, rows.slice(y, y + BAND).reduce((a, b) => a + b, 0)]);
scores.sort((a, b) => b[1] - a[1]);
const top = scores.slice(0, bands).sort((a, b) => a[0] - b[0]);
console.log(key, 'total rows with diffs:', rows.filter((r) => r > 20).length, 'of', diff.height);
for (const [y, n] of top) {
  const h = Math.min(BAND, diff.height - y);
  const parts = await Promise.all(['live', 'rebuild', 'diff'].map((k) => sharp(`${DIR}/${key}-${k}.png`).extract({ left: 0, top: y, width: diff.width, height: h }).png().toBuffer()));
  const out = `${DIR}/${key}-hot-${y}.png`;
  await sharp({ create: { width: diff.width * 3 + 20, height: h, channels: 4, background: '#f0f' } })
    .composite(parts.map((input, i) => ({ input, left: i * (diff.width + 10), top: 0 })))
    .png()
    .toFile(out);
  console.log(`y=${y}..${y + h} diffpx=${n} -> ${out}`);
}
