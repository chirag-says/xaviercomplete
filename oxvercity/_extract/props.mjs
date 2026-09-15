// Print the props object of a component call in a bundle, top level only.
//   node _extract/props.mjs <module-prefix> <marker> [maxLen]
import fs from 'node:fs';
const [prefix, marker, max = '4000'] = process.argv.slice(2);
const JS = 'D:/exporter/exports/oxv/ox-versity.framer.website/js';
const file = fs.readdirSync(JS).find((f) => f.startsWith(prefix));
const src = fs.readFileSync(`${JS}/${file}`, 'utf8');
let at = -1;
while ((at = src.indexOf(marker, at + 1)) !== -1) {
  // walk back to the opening brace of the enclosing object
  let depth = 0, i = at;
  for (; i >= 0; i--) { const ch = src[i]; if (ch === '}' || ch === ')' || ch === ']') depth++; else if (ch === '{' || ch === '(' || ch === '[') { if (depth === 0) break; depth--; } }
  const start = i;
  depth = 0; let end = start;
  for (let j = start; j < src.length; j++) { const ch = src[j]; if (ch === '`') { j = src.indexOf('`', j + 1); continue; } if (ch === '{' || ch === '(' || ch === '[') depth++; else if (ch === '}' || ch === ')' || ch === ']') { depth--; if (depth === 0) { end = j; break; } } }
  console.log(src.slice(start, Math.min(end + 1, start + Number(max))));
  console.log('-----');
}
