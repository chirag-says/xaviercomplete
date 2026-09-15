// Recover the site's scroll-driven effects from the Framer page bundles.
//
// Framer renders each "appear on scroll" element with its start state inline
// (opacity 0, translateY) and keeps the rest of the effect as props on the
// component call:
//   __framer__enter     start state   __framer__exit  state when leaving view
//   __framer__animate   {transition}  __framer__threshold  IntersectionObserver ratio
//   __framer__animateOnce             __targetOpacity  resting opacity
// Those props sit next to the element's className, which is also what the
// markup carries, so the join back onto the DOM is exact. Output: a table the
// runtime `FramerEffects` component replays.
//
// The bundle is minified JavaScript, so this is a small scanner rather than a
// regex: props are read at the depth of the props object (a nested `children`
// call carries its own className, and `children` sorts before `className`).
import fs from 'node:fs';
import path from 'node:path';

const JS = 'D:/exporter/exports/oxv/ox-versity.framer.website/js';
const MODULES = fs.readdirSync(JS).filter((f) => f.endsWith('.mjs'));
const OPEN = '([{';
const CLOSE = ')]}';

/** Text of the props object that contains `from`, top-level tokens only. */
function topLevel(src, from) {
  let depth = 0;
  let out = '';
  let i = from;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '`' || ch === '"' || ch === "'") {
      const end = src.indexOf(ch, i + 1);
      if (depth === 0) out += src.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    if (OPEN.includes(ch)) { if (depth === 0) out += ch; depth++; i++; continue; }
    if (CLOSE.includes(ch)) { depth--; if (depth < 0) return out; if (depth === 0) out += ch; i++; continue; }
    if (depth === 0) out += ch;
    i++;
  }
  return out;
}

/** Balanced literal starting at `src[at]` (an opening brace or bracket). */
function literalAt(src, at) {
  let depth = 0;
  for (let i = at; i < src.length; i++) {
    const ch = src[i];
    if (ch === '`' || ch === '"' || ch === "'") { i = src.indexOf(ch, i + 1); continue; }
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch)) { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  return null;
}

/** Nearest preceding `name=<literal>` definition, as a JS literal string. */
function definitionOf(src, name, before) {
  const re = new RegExp(`[,;(\\s]${name}=(?=[{\\[])`, 'g');
  let best = null;
  let m;
  while ((m = re.exec(src)) && m.index < before) best = m.index + m[0].length;
  return best === null ? null : literalAt(src, best);
}

/** JS object literal (minified Framer style) → value, resolving identifiers to their definitions. */
function evaluate(src, literal, before, depth = 0) {
  if (!literal || depth > 3) return null;
  let text = literal;
  // identifiers used as values → their own literals
  text = text.replace(/([:,\[])\s*([A-Za-z_$][\w$]*)(?=\s*[,}\]])/g, (whole, lead, id) => {
    if (['true', 'false', 'null', 'undefined'].includes(id)) return whole;
    const def = definitionOf(src, id, before);
    return def ? `${lead}${JSON.stringify(evaluate(src, def, before, depth + 1))}` : `${lead}null`;
  });
  const json = text
    .replace(/`([^`]*)`/g, '"$1"')
    .replace(/([{,])\s*([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/!0/g, 'true')
    .replace(/!1/g, 'false')
    .replace(/(^|[:,\[\s])\.(\d)/g, '$10.$2')
    .replace(/(^|[:,\[\s])-\.(\d)/g, '$1-0.$2')
    .replace(/void 0/g, 'null');
  try { return JSON.parse(json); } catch { return { unparsed: literal }; }
}

const appear = {};
const transforms = {};
const loops = {};
const variantAppear = [];
const conflicts = [];

for (const file of MODULES) {
  const src = fs.readFileSync(path.join(JS, file), 'utf8');
  const short = file.split('.')[0].slice(0, 12);
  const scan = (marker, onProps) => {
    let at = -1;
    while ((at = src.indexOf(marker, at + 1)) !== -1) {
      const props = topLevel(src, at);
      const className = (props.match(/className:`([^`]+)`/) || [])[1];
      onProps(props, className, at);
    }
  };

  scan('__framer__animate:', (props, className, at) => {
    if (!className) return;
    const value = (key) => (props.match(new RegExp(`${key}:(!0|!1|\\w+|[\\d.]+)`)) || [])[1];
    const lit = (key) => { const id = value(key); return id ? evaluate(src, definitionOf(src, id, at), at) : null; };
    // `props` has nested literals stripped, so read them from the source itself.
    const transitionLit = literalAt(src, at + '__framer__animate:'.length);
    const entry = {
      transition: evaluate(src, transitionLit, at)?.transition ?? null,
      enter: lit('__framer__enter'),
      exit: lit('__framer__exit'),
      once: value('__framer__animateOnce') === '!0',
      threshold: Number(value('__framer__threshold') ?? 0),
      targetOpacity: Number(value('__targetOpacity') ?? 1),
    };
    if (props.includes('__framer__scrollDirection')) {
      const sd = src.indexOf('__framer__scrollDirection:', at);
      entry.scrollDirection = evaluate(src, literalAt(src, sd + '__framer__scrollDirection:'.length), at);
    }
    const key = className.split(' ').find((c) => c !== 'ssr-variant') || className;
    if (appear[key] && JSON.stringify(appear[key]) !== JSON.stringify(entry)) conflicts.push(key);
    appear[key] = entry;
  });

  scan('__framer__transformTargets:', (props, className, at) => {
    if (!className) return;
    const targets = evaluate(src, literalAt(src, at + '__framer__transformTargets:'.length).replace(/ref:\w+,?/g, ''), at);
    const springAt = src.lastIndexOf('__framer__spring:', at);
    transforms[className] = {
      spring: springAt > at - 600 ? evaluate(src, literalAt(src, springAt + '__framer__spring:'.length), at) : null,
      targets,
      trigger: (props.match(/__framer__transformTrigger:`([^`]+)`/) || [])[1],
      threshold: Number((props.match(/__framer__transformViewportThreshold:([\d.]+)/) || [])[1] ?? 0),
      module: short,
    };
  });

  scan('__framer__loop:', (props, className, at) => {
    if (!className) return;
    const value = (key) => (props.match(new RegExp(`${key}:(\\w+|[\\d.]+|\`[^\`]*\`)`)) || [])[1];
    loops[className] = {
      loop: evaluate(src, definitionOf(src, value('__framer__loop'), at), at),
      transition: evaluate(src, definitionOf(src, value('__framer__loopTransition'), at), at),
      repeatType: (value('__framer__loopRepeatType') || '').replace(/`/g, ''),
      repeatDelay: Number(value('__framer__loopRepeatDelay') ?? 0),
      module: short,
    };
  });

  scan('__framer__variantAppearEffectEnabled', (props, className, at) => {
    variantAppear.push({
      module: short,
      className: className || null,
      id: (props.match(/\bid:`([^`]+)`/) || [])[1],
      once: (props.match(/__framer__animateOnce:(!0|!1)/) || [])[1] === '!0',
      threshold: Number((props.match(/__framer__threshold:([\d.]+)/) || [])[1] ?? 0),
      targets: (props.match(/__framer__targets:(\[[^\]]*\])/) || [])[1],
      variant: (props.match(/\bvariant:`([^`]+)`/) || [])[1],
      at,
    });
  });
}
for (const c of new Set(conflicts)) console.warn('conflicting definitions for', c);

const header = `// Generated by _extract/effects.mjs from the site's JavaScript bundles.
// Framer's own scroll effect specs. Regenerate rather than editing by hand.
`;
const types = `
export interface EffectTransition {
  type?: 'spring' | 'tween';
  damping?: number;
  stiffness?: number;
  mass?: number;
  delay?: number;
  duration?: number;
  ease?: number[];
  bounce?: number;
  stagger?: number;
}

export interface EffectState {
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  rotateX?: number;
  rotateY?: number;
  skewX?: number;
  skewY?: number;
  transition?: EffectTransition | null;
}

/** An "appear on scroll" effect: replayed when the element enters the viewport. */
export interface AppearEffect {
  transition: EffectTransition | null;
  enter: EffectState | null;
  exit: EffectState | null;
  once: boolean;
  threshold: number;
  targetOpacity: number;
  scrollDirection?: { direction: 'up' | 'down'; target: EffectState | null };
}

/** A scroll-linked transform: interpolated between targets as the element crosses the viewport. */
export interface TransformEffect {
  spring: EffectTransition | null;
  targets: { target: EffectState | null }[] | null;
  trigger: string | undefined;
  threshold: number;
  module: string;
}

export interface LoopEffect {
  loop: EffectState | null;
  transition: EffectTransition | null;
  repeatType: string;
  repeatDelay: number;
  module: string;
}
`;
fs.mkdirSync('D:/oxversity/src/data', { recursive: true });
fs.writeFileSync(
  'D:/oxversity/src/data/effects.ts',
  `${header}${types}
export const appearEffects: Record<string, AppearEffect> = ${JSON.stringify(appear, null, 2)};

export const transformEffects: Record<string, TransformEffect> = ${JSON.stringify(transforms, null, 2)};

export const loopEffects: Record<string, LoopEffect> = ${JSON.stringify(loops, null, 2)};
`,
);
fs.writeFileSync('D:/oxversity/_extract/variant-appear.json', JSON.stringify(variantAppear, null, 1));
console.log(`${Object.keys(appear).length} appear, ${Object.keys(transforms).length} transform, ${Object.keys(loops).length} loop, ${variantAppear.length} variant-appear; conflicts ${new Set(conflicts).size}`);
const summary = {};
for (const e of Object.values(appear)) { const k = JSON.stringify({ t: e.transition, enter: e.enter && { x: e.enter.x, y: e.enter.y, s: e.enter.scale, o: e.enter.opacity }, exit: !!e.exit, once: e.once, th: e.threshold }); summary[k] = (summary[k] || 0) + 1; }
for (const [k, n] of Object.entries(summary).sort((a, b) => b[1] - a[1])) console.log(n, k);
