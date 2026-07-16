import type { SummaryResult } from '../parse';
import type { BatchItem } from '../prompt';
import type { Category } from '../../types';

/**
 * Zero-dependency fallback when no Claude CLI is available:
 * cleaned title as headline, first sentence of the excerpt as summary,
 * category left to the source default (passed in by the caller).
 */
export function summariseBatchHeuristic(
  items: (BatchItem & { defaultCategory: Category })[]
): SummaryResult[] {
  return items.map((item) => ({
    id: item.id,
    headline: cleanTitle(item.title),
    summary: firstSentence(item.snippet) || cleanTitle(item.title),
    category: item.defaultCategory,
  }));
}

function cleanTitle(title: string): string {
  // strip trailing " - Site Name" / " | Site Name" suffixes and hard-truncate
  const stripped = title.replace(/\s+[-–—|]\s+[^-–—|]{3,40}$/, '').trim();
  return stripped.length > 90 ? `${stripped.slice(0, 87)}…` : stripped;
}

function firstSentence(text: string): string {
  if (!text) return '';
  const match = text.match(/^[\s\S]{10,180}?[.!?](?=\s|$)/);
  return (match ? match[0] : text.slice(0, 140)).trim();
}
