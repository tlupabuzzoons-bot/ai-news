import { createHash } from 'node:crypto';

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref$|source$|cmpid)/;

/** Normalise a URL so trivially different links hash identically. */
export function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    let s = u.toString();
    if (u.pathname !== '/' && s.endsWith('/')) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return raw.trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(normaliseUrl(url)).digest('hex');
}

/** Lowercase, strip diacritics/punctuation, collapse whitespace. */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(title: string): Set<string> {
  return new Set(normaliseTitle(title).split(' ').filter((t) => t.length > 2));
}

/** Jaccard similarity of token sets — 1 means identical vocabulary. */
export function titleSimilarity(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let intersection = 0;
  for (const t of sa) if (sb.has(t)) intersection++;
  return intersection / (sa.size + sb.size - intersection);
}

export const FUZZY_THRESHOLD = 0.85;
/** Generated headlines are short and vocabulary-dense — a lower bar catches paraphrases. */
export const HEADLINE_THRESHOLD = 0.72;

/** True if `title` is a near-duplicate of any existing title. */
export function isFuzzyDuplicate(
  title: string,
  existingTitles: Iterable<string>,
  threshold: number = FUZZY_THRESHOLD
): boolean {
  const norm = normaliseTitle(title);
  for (const existing of existingTitles) {
    if (normaliseTitle(existing) === norm) return true;
    if (titleSimilarity(title, existing) >= threshold) return true;
  }
  return false;
}
