// Print the balanced JSX element whose opening tag contains <marker>.
//   node _extract/snippet.mjs <file> <marker> [nth]
import fs from 'node:fs';
const [file, marker, nth = '0'] = process.argv.slice(2);
const src = fs.readFileSync(file, 'utf8');
let at = -1;
for (let i = 0; i <= Number(nth); i++) at = src.indexOf(marker, at + 1);
const open = src.lastIndexOf('<', at);
// walk tags to find the matching close
let depth = 0, i = open;
const tagRe = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
tagRe.lastIndex = open;
let m;
while ((m = tagRe.exec(src))) {
  if (m[1]) depth--; else if (!m[4]) depth++;
  if (depth === 0) { i = m.index + m[0].length; break; }
}
const out = src.slice(open, i).split('\n').map((l) => l.replace(/^\s{2,}/, (s) => ' '.repeat(Math.min(s.length / 2, 12)))).join('\n');
process.stdout.write(out + '\n');
