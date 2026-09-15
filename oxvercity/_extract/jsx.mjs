// Convert a subtree of a Framer server-rendered page into a React component.
//
//   node _extract/jsx.mjs <page> <selector> <out.tsx> <Name> [--children=a:b] [--client]
//
// The rebuild keeps Framer's CSS as its styling baseline, so a component only
// looks right if it reproduces Framer's markup and class names exactly. That
// markup is far too large to retype by hand, so it is converted mechanically
// and refactored afterwards: literals become props, repeated blocks become
// data-driven loops. Image URLs are rewritten through assets.json.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const WORK = 'D:/exporter/exports/oxv/_work';
const LIVE = { home: 'live-home.html', about: 'live-about-us.html', programs: 'live-programs.html', contact: 'live-contact-us.html' };
const ASSETS = JSON.parse(fs.readFileSync(new URL('./assets.json', import.meta.url), 'utf8'));

const ATTRIBUTE_MAP = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength',
  minlength: 'minLength', colspan: 'colSpan', rowspan: 'rowSpan', autoplay: 'autoPlay', autofocus: 'autoFocus',
  autocomplete: 'autoComplete', srcset: 'srcSet', crossorigin: 'crossOrigin', datetime: 'dateTime',
  enctype: 'encType', novalidate: 'noValidate', spellcheck: 'spellCheck', playsinline: 'playsInline',
  allowfullscreen: 'allowFullScreen', frameborder: 'frameBorder', 'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', 'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset', 'stroke-opacity': 'strokeOpacity', 'stroke-miterlimit': 'strokeMiterlimit',
  'fill-rule': 'fillRule', 'fill-opacity': 'fillOpacity', 'clip-rule': 'clipRule', 'clip-path': 'clipPath',
  'stop-color': 'stopColor', 'stop-opacity': 'stopOpacity', 'text-anchor': 'textAnchor', 'font-family': 'fontFamily',
  'font-size': 'fontSize', 'font-weight': 'fontWeight', 'letter-spacing': 'letterSpacing',
  'dominant-baseline': 'dominantBaseline', 'vector-effect': 'vectorEffect', gradientunits: 'gradientUnits',
  patternunits: 'patternUnits', preserveaspectratio: 'preserveAspectRatio', 'xlink:href': 'xlinkHref', viewbox: 'viewBox',
  'fetchpriority': 'fetchPriority',
};
const DROP = new Set(['data-framer-appear-animation', 'parentsize', 'rotation', 'shadows', 'withexternallayout', 'enabledgestures', 'nodeid', 'issuperseded']);
const NUMERIC = new Set(['tabIndex', 'colSpan', 'rowSpan', 'span', 'start', 'maxLength', 'minLength', 'size', 'rows', 'cols']);
const BOOLEAN = new Set(['selected', 'checked', 'disabled', 'readOnly', 'required', 'multiple', 'autoPlay', 'controls', 'loop', 'muted', 'open', 'autoFocus', 'noValidate', 'playsInline', 'allowFullScreen', 'hidden']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const NAME_ALLOWED = new Set(['input', 'select', 'textarea', 'form', 'button', 'output', 'fieldset', 'iframe', 'meta', 'slot']);

let page = 'home';
// Routes: the rebuild exposes /, /about, /programs, /contact and /search.
// Everything else keeps its original path so the link data stays honest.
const ROUTES = { './': '/', './about-us': '/about', './contact-us': '/contact', './programs': '/programs' };
const rewriteHref = (h) => {
  if (h in ROUTES) return ROUTES[h];
  if (h.startsWith('./')) return '/' + h.slice(2).replace(/\/$/, '');
  return h;
};
const rewriteUrl = (u) => {
  if (!u.includes('framerusercontent.com/images')) return u;
  const hit = ASSETS[`${page}|${u}`];
  if (!hit) throw new Error(`asset not mapped for ${page}: ${u}`);
  return hit;
};
const rewriteSrcset = (v) => v.split(',').map((c) => c.trim()).filter(Boolean).map((c) => {
  const i = c.search(/\s/);
  return i === -1 ? rewriteUrl(c) : `${rewriteUrl(c.slice(0, i))}${c.slice(i)}`;
}).join(', ');

function styleToObject(css) {
  const entries = [];
  let buffer = '';
  let depth = 0;
  for (const ch of css) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { entries.push(buffer); buffer = ''; } else buffer += ch;
  }
  entries.push(buffer);
  const pairs = [];
  for (const entry of entries) {
    const index = entry.indexOf(':');
    if (index === -1) continue;
    const raw = entry.slice(0, index).trim();
    let value = entry.slice(index + 1).trim();
    if (!raw || !value) continue;
    value = value.replace(/url\(("|')?([^"')]+)\1?\)/g, (_m, q, u) => `url(${q || ''}${rewriteUrl(u)}${q || ''})`);
    const name = raw.startsWith('--') ? `'${raw}'` : raw.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    pairs.push(`${name}: ${JSON.stringify(value)}`);
  }
  return pairs.length ? `{ ${pairs.join(', ')} }` : null;
}

function renderAttributes(node) {
  const parts = [];
  for (const [rawName, rawValue] of Object.entries(node.attribs ?? {})) {
    const lower = rawName.toLowerCase();
    if (DROP.has(lower) || lower.startsWith('_')) continue;
    if (lower === 'name' && !NAME_ALLOWED.has(node.name)) continue;
    if (lower === 'srcset' || lower === 'imagesrcset') { parts.push(`${ATTRIBUTE_MAP[lower] ?? lower}={${JSON.stringify(rewriteSrcset(rawValue))}}`); continue; }
    if (lower === 'style') { const o = styleToObject(rawValue); if (o) parts.push(`style={${o} as React.CSSProperties}`); continue; }
    const name = ATTRIBUTE_MAP[lower] ?? (lower.startsWith('data-') || lower.startsWith('aria-') ? lower : rawName);
    if (name.includes('-') && !name.startsWith('data-') && !name.startsWith('aria-')) continue;
    // React treats `value`/`checked` as controlled; the markup only carries defaults.
    if ((lower === 'value' || lower === 'checked') && (node.name === 'input' || node.name === 'textarea')) { parts.push(`${lower === 'value' ? 'defaultValue' : 'defaultChecked'}={${lower === 'value' ? JSON.stringify(rawValue) : rawValue.trim().toLowerCase() !== 'false'}}`); continue; }
    if (BOOLEAN.has(name)) { parts.push(`${name}={${rawValue.trim().toLowerCase() !== 'false'}}`); continue; }
    if (NUMERIC.has(name) && /^-?\d+$/.test(rawValue.trim())) { parts.push(`${name}={${Number(rawValue)}}`); continue; }
    const value = lower === 'src' ? rewriteUrl(rawValue) : lower === 'href' ? rewriteHref(rawValue) : rawValue;
    parts.push(`${name}={${JSON.stringify(value)}}`);
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}

function renderNode(node, indent) {
  const pad = '  '.repeat(indent);
  if (node.type === 'text') {
    const text = node.data.replace(/\s+/g, ' ');
    if (!text) return '';
    if (!text.trim()) return `${pad}{' '}\n`;
    return `${pad}{${JSON.stringify(text)}}\n`;
  }
  if (node.type === 'comment' || !node.name) return '';
  if (node.name === 'style' || node.name === 'script') return '';
  const attributes = renderAttributes(node);
  if (VOID.has(node.name)) return `${pad}<${node.name}${attributes} />\n`;
  const children = (node.children ?? []).map((c) => renderNode(c, indent + 1)).join('');
  if (!children) return `${pad}<${node.name}${attributes} />\n`;
  return `${pad}<${node.name}${attributes}>\n${children}${pad}</${node.name}>\n`;
}

const [pageArg, selector, out, name, ...flags] = process.argv.slice(2);
if (!pageArg || !selector || !out || !name) {
  console.error('usage: node _extract/jsx.mjs <page> <selector> <out.tsx> <Name> [--children=a:b] [--client]');
  process.exit(1);
}
page = pageArg;
const $ = cheerio.load(fs.readFileSync(path.join(WORK, LIVE[page]), 'utf8'));
const node = $(selector).first();
if (!node.length) { console.error(`selector matched nothing: ${selector}`); process.exit(1); }
const range = flags.find((f) => f.startsWith('--children='));
let nodes = [node.get(0)];
if (range) {
  const [from, to] = range.split('=')[1].split(':').map(Number);
  nodes = node.children().slice(from - 1, to).get();
}
const rendered = nodes.map((n) => renderNode(n, 3).trimEnd()).join('\n');
const jsx = nodes.length === 1 && !range ? renderNode(nodes[0], 2).trimEnd() : `    <>\n${rendered}\n    </>`;
const directive = flags.includes('--client') ? "'use client';\n\n" : '';
const body = `${directive}/**
 * Generated from the Framer site's server-rendered ${page} page by _extract/jsx.mjs.
 * Selector: ${selector}${range ? ` ${range}` : ''}
 *
 * Markup and class names are reproduced verbatim so the extracted Framer CSS
 * styles it exactly as the original.
 */

export function ${name}() {
  return (
${jsx}
  );
}
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, body, 'utf8');
console.log(`${name} → ${out} (${(body.length / 1024).toFixed(1)}KB)`);
