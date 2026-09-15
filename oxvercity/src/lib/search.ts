/**
 * The site's search, ported from Framer's search library so `/search` and the
 * header modal rank results the way the original did.
 *
 * Every page is an entry of title, headings and paragraphs. A query is split
 * into tokens; each token scores each entry (URL and title tokens count most,
 * headings next, body text least, with a Levenshtein allowance of two edits
 * for near-misses) and the entries are ordered by total score.
 */

export interface SearchEntry {
  url: string;
  title: string;
  description: string;
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
  p: string[];
}

export interface SearchResult {
  url: string;
  title: string;
  description: string;
  score: number;
}

const DIACRITICS = /[̀-ͯ]/g;
const SEPARATORS = (() => {
  try {
    return new RegExp('[\\s.,;!?\\p{P}\\p{Z}]+(?<!\\p{L}&)(?!&\\p{L})', 'u');
  } catch {
    return new RegExp('[\\s.,;!?\\p{P}\\p{Z}]+', 'u');
  }
})();

const normalize = (value: string) => value.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
const tokens = (value: string) => new Set(value.split(SEPARATORS).filter((t) => t.trim() && t.length > 0));

function levenshtein(a: string, b: string): number {
  if (a.length < b.length) [a, b] = [b, a];
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const current = [i + 1];
    for (let j = 0; j < b.length; j++) {
      current.push(Math.min(previous[j + 1] + 1, current[j] + 1, previous[j] + (a[i] === b[j] ? 0 : 1)));
    }
    previous = current;
  }
  return previous[b.length];
}

type Normalized = Omit<SearchEntry, 'url'> & { url: string };

const cache = new WeakMap<SearchEntry, Normalized>();
function normalized(entry: SearchEntry): Normalized {
  const hit = cache.get(entry);
  if (hit) return hit;
  const out = {
    url: normalize(entry.url),
    title: normalize(entry.title),
    description: normalize(entry.description),
    h1: entry.h1.map(normalize),
    h2: entry.h2.map(normalize),
    h3: entry.h3.map(normalize),
    h4: entry.h4.map(normalize),
    h5: entry.h5.map(normalize),
    h6: entry.h6.map(normalize),
    p: entry.p.map(normalize),
  };
  cache.set(entry, out);
  return out;
}

function scoreToken(entry: Normalized, token: string, queryTokens: Set<string>, query: string): number {
  let score = 0;
  const urlTokens = tokens(entry.url);
  if (urlTokens.has(token)) score += 10;
  if (queryTokens.size === 1 && urlTokens.size === 1 && urlTokens.values().next().value === token) score += score * 5;

  const titleTokens = tokens(entry.title);
  if (titleTokens.has(token)) score += 10;
  if (entry.title.indexOf(token) !== -1) score += 10;
  if (levenshtein(entry.title, query) <= 2) score += score * 10;
  for (const t of titleTokens) if (levenshtein(token, t) <= 2) score += 10;

  for (const heading of [...entry.h1, ...entry.h2, ...entry.h3, ...entry.h4, ...entry.h5, ...entry.h6]) {
    const headingTokens = tokens(heading);
    if (levenshtein(heading, query) <= 2) score += score * 10;
    if (heading.startsWith(token)) score += 10;
    if (headingTokens.has(token)) score += 10;
    if (heading.includes(token)) score += 1;
    for (const t of headingTokens) if (levenshtein(token, t) <= 2) score += 1;
  }

  if (entry.description.indexOf(token) !== -1) score += 10;
  for (const paragraph of entry.p) if (paragraph.includes(token)) score += 0.5;
  return score;
}

/** Rank `entries` for `query`, leaving out the page the visitor is on. */
export function search(entries: SearchEntry[], rawQuery: string, currentPath?: string): SearchResult[] {
  const query = normalize(rawQuery);
  const queryTokens = tokens(query);
  if (queryTokens.size === 0) return [];
  const results: SearchResult[] = [];
  for (const entry of entries) {
    const n = normalized(entry);
    let score = 0;
    for (const token of queryTokens) score += scoreToken(n, token, queryTokens, query);
    if (score > 0 && entry.url !== currentPath) {
      results.push({ url: entry.url, title: entry.h1[0] || entry.title, description: entry.description, score });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 20);
}
