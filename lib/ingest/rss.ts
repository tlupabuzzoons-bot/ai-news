import Parser from 'rss-parser';
import { AI_KEYWORDS, type FeedSource } from '../sources';

export interface CandidateItem {
  sourceName: string;
  category: FeedSource['category'];
  title: string;
  url: string;
  publishedAt: string; // ISO8601
  snippet: string;
}

const MAX_AGE_HOURS = 48;
const DEFAULT_MAX_PER_RUN = 25;

const parser = new Parser({
  timeout: 15_000,
  headers: {
    'User-Agent': 'AIDailyBrief/1.0 (self-hosted news dashboard)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
  },
});

// Word-boundary match so "ai" doesn't hit "air"; multi-word phrases matched as-is.
const KEYWORD_RE = new RegExp(
  `(?:^|[^\\p{L}])(${AI_KEYWORDS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:[^\\p{L}]|$)`,
  'iu'
);

export function matchesAiKeywords(text: string): boolean {
  return KEYWORD_RE.test(text);
}

export async function fetchFeed(source: FeedSource): Promise<CandidateItem[]> {
  const feed = await parser.parseURL(source.url);
  const cutoff = Date.now() - MAX_AGE_HOURS * 3_600_000;
  const items: CandidateItem[] = [];

  for (const item of feed.items ?? []) {
    const title = item.title?.trim();
    const url = item.link?.trim();
    if (!title || !url) continue;

    const publishedRaw = item.isoDate ?? item.pubDate;
    const published = publishedRaw ? new Date(publishedRaw) : null;
    if (!published || Number.isNaN(published.getTime())) continue; // spec: real pubDate only
    if (published.getTime() < cutoff) continue;

    const snippet = (item.contentSnippet ?? item.summary ?? '').trim().slice(0, 500);
    if (source.aiFilter && !matchesAiKeywords(`${title} ${snippet}`)) continue;

    items.push({
      sourceName: source.name,
      category: source.category,
      title,
      url,
      publishedAt: published.toISOString(),
      snippet,
    });
  }
  // newest first, capped so high-volume feeds (arXiv) can't flood the board
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return items.slice(0, source.maxPerRun ?? DEFAULT_MAX_PER_RUN);
}
