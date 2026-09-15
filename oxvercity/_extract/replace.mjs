// Replace balanced JSX elements in a generated section with a component call.
//   node _extract/replace.mjs <file> <marker> <replacement> [--all] [--inner]
// <marker> selects every opening tag containing it; <replacement> may use
// $CLASS (the element's className) and $NAME (its data-framer-name).
// --inner keeps the element and replaces only its children.
import fs from 'node:fs';
const [file, marker, replacement, ...flags] = process.argv.slice(2);
let src = fs.readFileSync(file, 'utf8');
const all = flags.includes('--all');
const inner = flags.includes('--inner');
const tagRe = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
let from = 0;
let count = 0;
while (true) {
  const at = src.indexOf(marker, from);
  if (at === -1) break;
  const open = src.lastIndexOf('<', at);
  tagRe.lastIndex = open;
  let depth = 0;
  let end = -1;
  let openEnd = -1;
  let closeStart = -1;
  let m;
  while ((m = tagRe.exec(src))) {
    if (m.index === open) openEnd = m.index + m[0].length;
    if (m[1]) depth--; else if (!m[4]) depth++;
    if (depth === 0) { closeStart = m[1] ? m.index : m.index + m[0].length; end = m.index + m[0].length; break; }
  }
  const openTag = src.slice(open, openEnd);
  const cls = (openTag.match(/className=\{"([^"]*)"\}/) || [])[1] || '';
  const name = (openTag.match(/data-framer-name=\{"([^"]*)"\}/) || [])[1] || '';
  const body = replacement.replace(/\$CLASS/g, cls).replace(/\$NAME/g, name);
  if (inner) src = src.slice(0, openEnd) + '\n' + body + '\n' + src.slice(closeStart);
  else src = src.slice(0, open) + body + src.slice(end);
  from = open + body.length;
  count++;
  if (!all) break;
}
fs.writeFileSync(file, src);
console.log(`${file}: ${count} replaced`);
