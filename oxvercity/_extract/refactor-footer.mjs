// Make the generated footer data-driven and reusable across both layout
// templates (main pages and contact/search): links and copy come from
// src/data/site.ts, the breakpoint hashes and the wrapper class become props.
//   node _extract/refactor-footer.mjs
import fs from 'node:fs';

const FILE = 'D:/oxversity/src/components/layout/Footer.tsx';
let src = fs.readFileSync(FILE, 'utf8');
const tagRe = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;

function replaceElements(marker, make, { inner = false } = {}) {
  let from = 0;
  let n = 0;
  while (true) {
    const at = src.indexOf(marker, from);
    if (at === -1) break;
    const open = src.lastIndexOf('<', at);
    tagRe.lastIndex = open;
    let depth = 0, end = -1, openEnd = -1, closeStart = -1, m;
    while ((m = tagRe.exec(src))) {
      if (m.index === open) openEnd = m.index + m[0].length;
      if (m[1]) depth--; else if (!m[4]) depth++;
      if (depth === 0) { closeStart = m[1] ? m.index : m.index + m[0].length; end = m.index + m[0].length; break; }
    }
    const body = make(src.slice(open, end), n);
    if (inner) src = src.slice(0, openEnd) + '\n' + body + '\n' + src.slice(closeStart);
    else src = src.slice(0, open) + body + src.slice(end);
    from = open + body.length + (inner ? openEnd - open : 0);
    n++;
  }
  if (!n) throw new Error('marker not found: ' + marker);
  return n;
}
function replaceText(literal, expr) {
  const needle = `{"${literal}"}`;
  if (!src.includes(needle)) throw new Error('text not found: ' + literal);
  src = src.split(needle).join(`{${expr}}`);
}

// Link lists: four per breakpoint copy, in the order desktop, phone, tablet.
const VARIANTS = ['default', 'small', 'small'];
const count = replaceElements('data-framer-name={"List Item Block"}', (_, n) => {
  const column = n % 4;
  return `{footerColumns[${column}].links.map((link, i) => <FooterLink key={link.href} link={link} variant="${VARIANTS[Math.floor(n / 4)]}" containerClass={LINK_CONTAINERS[${column}][i] ?? LINK_CONTAINERS[${column}][LINK_CONTAINERS[${column}].length - 1]} />)}`;
}, { inner: true });
if (count !== 12) throw new Error('expected 12 list blocks, got ' + count);

replaceText('Main Pages', 'footerColumns[0].title');
replaceText('Programs', 'footerColumns[1].title');
replaceText('Support', 'footerColumns[2].title');
replaceText('Utility Pages', 'footerColumns[3].title');
replaceText('Campus Office', 'contact.officeLabel');
replaceText('45 College Street, Greenfield Boston, MA 02115, USA', "contact.address.join('\\u2028')");
src = src.replace(/href=\{"https:\/\/www\.google\.com\/maps[^"]*"\}/g, 'href={contact.addressHref}');
replaceText('Email', 'contact.emailLabel');
src = src.split('href={"mailto:hello@mflowtcompany.com"}').join('href={`mailto:${contact.email}`}');
replaceText('hello@mflowtcompany.com', 'contact.email');
src = src.split('src={"/svg/logo-dark.svg"}').join('src={siteLogo.dark}');
src = src.split(' data-framer-page-link-current={"true"}').join('');

// Breakpoint hashes and the layout slot become props.
const HASH = { '8j9uhy': 'desktop', '4y47at': 'tablet', mygaao: 'phone' };
src = src.replace(/className=\{"([^"]*hidden-[^"]*)"\}/g, (_, cls) => 'className={`' + cls.replace(/hidden-(\w+)/g, (all, h) => (HASH[h] ? `hidden-\${hashes.${HASH[h]}}` : all)) + '`}');
src = src.split('className={"framer-1dc0cev-container"}').join('className={containerClass}');

src = src.replace(
  /\/\*\*[\s\S]*?\*\/\n\nexport function Footer\(\) \{/,
  `/**
 * The site footer, generated from the Framer site's server-rendered markup
 * (_extract/jsx.mjs, then _extract/refactor-footer.mjs). Copy, contact
 * details and link lists come from src/data/site.ts. The two layout
 * templates (main pages; contact and search) differ only in their breakpoint
 * hashes and the wrapper class, which are props.
 */

import { FooterLink } from './FooterLink';
import { LAYOUT_HASHES, type BreakpointHashes } from '@/lib/breakpoints';
import { contact, footerColumns, siteLogo } from '@/data/site';

/** Framer's layout slot for each link, per column. */
const LINK_CONTAINERS = [
  ['framer-izdigx-container', 'framer-av3n65-container', 'framer-1xog0rv-container', 'framer-1lsiork-container', 'framer-6yhaz4-container'],
  ['framer-wd0hgi-container', 'framer-1bdo07-container', 'framer-4rbr4a-container', 'framer-xur1h1-container'],
  ['framer-1uvd8ko-container'],
  ['framer-1a1mchw-container', 'framer-11btwj9-container', 'framer-1qwqaiz-container'],
];

export function Footer({ hashes = LAYOUT_HASHES.main, containerClass = 'framer-1dc0cev-container' }: { hashes?: BreakpointHashes; containerClass?: string }) {`,
);
fs.writeFileSync(FILE, src);
console.log('footer refactored, lines:', src.split('\n').length);
