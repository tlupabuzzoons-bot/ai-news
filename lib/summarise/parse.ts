import { CATEGORIES, type Category } from '../types';

export interface SummaryResult {
  id: string;
  headline: string;
  summary: string;
  category: Category;
}

/**
 * Defensive extraction per spec §5: greedy array match, JSON.parse in
 * try/catch, validate shape. Returns null when nothing usable is found.
 */
export function extractSummaries(raw: string): SummaryResult[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const results: SummaryResult[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, headline, summary, category } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof headline !== 'string' || typeof summary !== 'string') continue;
    if (!headline.trim() || !summary.trim()) continue;
    const cat = (CATEGORIES as readonly string[]).includes(category as string)
      ? (category as Category)
      : null;
    if (!cat) continue;
    results.push({ id, headline: headline.trim(), summary: summary.trim(), category: cat });
  }
  return results.length > 0 ? results : null;
}
