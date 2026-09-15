// Copy every image the five pages use into public/ under readable names, and
// write the map the JSX generator uses to rewrite framerusercontent URLs.
//
// Framer names images by an opaque id and serves scaled variants through a
// `scale-down-to` query. Here each id becomes a meaningful name; the full-size
// file keeps the bare name and each variant gets a `-<width>` suffix, e.g.
//   /images/home/hero-bg.png, /images/home/hero-bg-1024.png
// Files come from the export where it has them and from the CDN otherwise
// (the export was captured at desktop size, so phone-only images are absent).
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const EXPORT = 'D:/exporter/exports/oxv/ox-versity.framer.website';
const WORK = 'D:/exporter/exports/oxv/_work';
const OUT = 'D:/oxversity/public';
const LIVE = { home: 'live-home.html', about: 'live-about-us.html', programs: 'live-programs.html', contact: 'live-contact-us.html', tabs: 'tabs.html' };

/** Framer image id → public name. An id shared by two contexts gets a copy per context. */
const NAMES = {
  Hez1qdcBJlvfISgXn4jOCxnrJqo: 'logo-white',
  ELp5sTiM32J348ebBxf863DsoAA: 'logo-dark',
  GORH9yT2ecrhhV0qYX7ykSRfzY: 'home/hero-bg',
  uzhbB4QEBdRWmEreYjxvYtqw: { home: 'home/about-slide-1', tabs: 'home/tab-innovation-1' },
  YRsFuOQHPHJievtdeSKVQAHALuw: 'home/about-slide-2',
  eXdsgkDPOT2Ax0XQoVcn7fDUA: 'home/about-slide-3',
  '6V01He2fZma1Ci18E8Xzgp03c': 'home/faculty-business-studies',
  bbkWUUZrKMbjejBfrbNARGPxYw: 'home/faculty-computer-science',
  frxuHeS2SJPVVLRqse3QBJZnsw: { home: 'home/faculty-health-sciences', about: 'about/hero-bg' },
  EDLzdIG9Zu69rrOrQDHbV5JdfMY: 'icons/arrow-left',
  DLiEpYpQOug2epZad2TwG2OTP10: 'icons/arrow-right',
  Ij7pBxWSNXzPk8HNLTK4gWZA: 'home/tab-research-1',
  Q1sahBCGgYZDUjgvjLhQ3zqOkA: 'home/tab-innovation-2',
  JmuxP3QjeX6mKvtHZkLRScgdnk: 'home/tab-community-2',
  bkfwd2IhFoMnuBM5bUtFntDH7k: 'home/tab-research-2',
  SUgkBeZkd8dG2rPCrSNJ1jVbplg: 'programs/bsc-computer-science',
  B8e83N2OXhlYgsWl3ZZ5ZirHZgg: { home: 'programs/postgraduate', programs: 'programs/postgraduate', about: 'news/alumni-achievements-that-inspire' },
  cw8nYPuPUyiruQqZAhGerdRWI: 'programs/professional-studies',
  PD1swS6bq4O0A6RQ7QS0nybQ: 'programs/certificate-courses',
  FtRbE2Z6d3BRgXdlG6EkNBBb1Rc: 'programs/online-programs',
  cTrzSOnH8PSyUuKLz088kMjCr8: 'programs/research-degrees',
  Mgiqp79E2epOkgj76X6zxL4Iak: 'programs/short-term-programs',
  hpE3kaSskmE0EqVxIH2xZW8o6bg: 'programs/exchange-programs',
  UHfRaZ5oKzONVwM9SA29tShnjDw: 'home/campus-sports-wellness',
  '5WuSvd8iyMwjyVPONZ3EZxdN3s': 'home/campus-libraries',
  '9HKn4nEk92iUDi4K2bx5ciagH6U': 'home/campus-gym',
  aVzDVyXaFPpjYUHXYyqORh3VtI: 'home/campus-university-lab',
  NhrfqAp7MY6hXPhAGMspCFbRY1Q: 'events/perspectives-on-higher-education',
  Wvr6FBLxvWeveZ1hQSWdELvxSE4: 'events/digital-transformation',
  dKQeFgAZDRG2vz8bfAu4Glr2Rq0: 'events/graduate-open-house',
  m1w60xcMT8pKZuqDxHBojQNn2MY: 'events/poetry-philosophy',
  cVJSogI7wHjUtWC98XE9Rs1eoo: 'events/innovations-in-medical-research',
  c6PLxAWx8r3KVPkU1AporrW97NM: 'events/global-entrepreneurship-summit',
  b5dgzXwb8Q1NP0x2XqcnoU2VNc: { home: 'shared/contact-cta-bg', about: 'shared/contact-cta-bg', tabs: 'home/tab-community-1' },
  ED4sTls3FgEXqB0QBBwFmvCQhg: 'about/story-image-1',
  sicnTwAURJHwDDtYSS4AgtDgUc: 'about/story-image-2',
  sLWg2gFzs6DNPPY5cfiyYPQXrkA: 'about/story-image-3',
  skhhLcOKJiC4EiHkSX6awfchUM: 'about/facts-image',
  xPC2bQhWqtdgCq1Xpnu3ml8zbxo: 'about/since-1960-image',
  HH8KrojyxZx6X20z1r13CSwiiWE: 'about/reviewer-1',
  KuIBzI0VbhnNU4FBscAHrIRO2DQ: 'about/reviewer-2',
  BFjvDSKxQrpdG8TWrnSjYLgBeE: 'about/reviewer-3',
  '279u9M7ZgjOPx89LQ8utFrgA1rw': 'about/partner-logo-1',
  F05Cg2dNnTlzdt62QISZiBrssn0: 'about/partner-logo-2',
  nLdKGGqfibZkYV8xx6nwmfg7Lrw: 'about/partner-logo-3',
  t8Wz25laeWoJgVOLu9frF5nbqKE: 'about/partner-logo-4',
  qKXWqvQ4K3bhY0PwDPL9cHX77r0: 'about/partner-logo-5',
  fSKKRRxrUvlneGlMBhVcyyJrbDo: 'about/partner-logo-6',
  D7KtsWjaboaKqckF3PH1hkoJLU: 'news/pioneering-education-for-the-future-of-2025',
  ipN7UVl89FppxyPUKhHUvtzN8: 'news/innovative-projects-from-our-research-teams',
  tlJpPfwvGgUyIbVAMGUgKhgK0: 'news/integrating-tech-into-modern-education',
  IihpdifIbWGZA8Mwo5URDrDSH4Y: 'programs/hero-bg',
  ekYnRH7BFDtQPj0jtyM9ONPVI74: 'icons/social-linkedin',
  l1gZKSdThNO9kHmnH7I7rWNkTe4: 'icons/social-x',
  BHlMmIso0en1TwerZqCORuhwE: 'icons/social-instagram',
  GkNTTQ1U1iSlIeOIfUDgnk78lFs: 'icons/social-dribbble',
};

const idOf = (url) => (url.match(/\/images\/([A-Za-z0-9_]+)(?:-[0-9a-f]{6})?\.[a-z]+/) || [])[1];
const extOf = (url) => (url.match(/\.(png|jpe?g|svg|webp|gif|avif)/i) || [])[1].toLowerCase();
const widthOf = (url) => (url.match(/scale-down-to=(\d+)/) || [])[1];
const candidates = (srcset) => (srcset || '').split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
  const i = c.search(/\s/);
  return i === -1 ? [c, ''] : [c.slice(0, i), c.slice(i).trim()];
});

// 1. What the export has on disk, keyed by id + srcset width descriptor.
const onDisk = new Map();
for (const f of fs.readdirSync(EXPORT, { recursive: true }).filter((f) => f.endsWith('index.html'))) {
  const $ = cheerio.load(fs.readFileSync(path.join(EXPORT, f), 'utf8'));
  $('img').each((_, e) => {
    const { src = '', srcset = '' } = e.attribs;
    const id = idOf(src) || idOf(srcset);
    if (!id) return;
    const local = (p) => path.join(EXPORT, 'assets', p.replace(/^(?:\.{1,2}\/)*assets\//, ''));
    if (src) onDisk.set(`${id}|src`, local(src));
    for (const [u, d] of candidates(srcset)) onDisk.set(`${id}|${d}`, local(u));
  });
}

// 2. Every URL the live pages use, with the name it should get per page.
const wanted = new Map();
for (const [page, file] of Object.entries(LIVE)) {
  const $ = cheerio.load(fs.readFileSync(path.join(WORK, file), 'utf8'));
  $('img').each((_, e) => {
    const { src = '', srcset = '' } = e.attribs;
    if (src) wanted.set(`${page}|${src}`, { page, url: src, descriptor: 'src' });
    for (const [u, d] of candidates(srcset)) wanted.set(`${page}|${u}`, { page, url: u, descriptor: d });
  });
  $('[style*="url("]').each((_, e) => {
    for (const m of e.attribs.style.matchAll(/url\(("|')?([^"')]+)\1?\)/g)) {
      if (m[2].includes('framerusercontent')) wanted.set(`${page}|${m[2]}`, { page, url: m[2], descriptor: 'src' });
    }
  });
}

const publicName = (id, page, url) => {
  const entry = NAMES[id];
  const base = typeof entry === 'string' ? entry : entry?.[page];
  if (!base) throw new Error(`no name for image ${id} on ${page}`);
  const ext = extOf(url);
  const w = widthOf(url);
  const dir = ext === 'svg' ? 'svg' : 'images';
  return `/${dir}/${base}${w ? `-${w}` : ''}.${ext}`;
};

const map = {};
let copied = 0;
let downloaded = 0;
for (const { page, url, descriptor } of wanted.values()) {
  const id = idOf(url);
  if (!id) continue;
  const rel = publicName(id, page, url);
  map[`${page}|${url}`] = rel;
  const dest = path.join(OUT, rel);
  if (fs.existsSync(dest)) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const source = onDisk.get(`${id}|${descriptor}`) || (widthOf(url) ? onDisk.get(`${id}|${widthOf(url)}w`) : null);
  if (source && fs.existsSync(source)) {
    fs.copyFileSync(source, dest);
    copied++;
  } else {
    const res = await fetch(url);
    if (!res.ok) { console.warn('download failed', url, res.status); continue; }
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    downloaded++;
    console.log('downloaded', rel);
  }
}

fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(EXPORT, 'assets/fonts'))) {
  fs.copyFileSync(path.join(EXPORT, 'assets/fonts', f), path.join(OUT, 'fonts', f));
}
fs.writeFileSync('D:/oxversity/_extract/assets.json', JSON.stringify(map, null, 1));
console.log(`urls ${Object.keys(map).length}, copied ${copied}, downloaded ${downloaded}`);
