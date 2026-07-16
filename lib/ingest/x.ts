import Parser from 'rss-parser';
import type { CandidateItem } from './rss';

/** Accounts from the spec §4 X query. Add a handle here to follow it. */
export const X_HANDLES = [
  'claudeai',
  'perplexity_ai',
  'testingcatalog',
  'WatcherGuru',
  'KobeissiLetter',
  'Bloomberg',
  'StockMKTNewz',
  'hospodarky',
  'OpenAI',
];

/** Public Nitter mirrors — unreliable by nature; tried in order, last-good remembered. */
const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://xcancel.com',
  'https://nitter.poast.org',
  'https://lightbrd.com',
  'https://nitter.space',
  'https://nitter.privacyredirect.com',
];

const MAX_AGE_HOURS = 48;
const MAX_PER_HANDLE = 10;

export function hasXToken(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN);
}

// ── X API v2 (used when X_BEARER_TOKEN is set) ─────────────────────────────

interface XApiResponse {
  data?: { id: string; text: string; created_at: string; author_id: string }[];
  includes?: { users?: { id: string; username: string }[] };
}

export async function fetchSocialViaApi(): Promise<CandidateItem[]> {
  const query = `(${X_HANDLES.map((h) => `from:${h}`).join(' OR ')}) -is:retweet`;
  const params = new URLSearchParams({
    query,
    'tweet.fields': 'created_at,public_metrics,entities',
    expansions: 'author_id',
    max_results: '50',
  });
  const res = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` },
  });
  if (!res.ok) throw new Error(`X API ${res.status}`);
  const body = (await res.json()) as XApiResponse;

  const users = new Map((body.includes?.users ?? []).map((u) => [u.id, u.username]));
  const cutoff = Date.now() - MAX_AGE_HOURS * 3_600_000;
  const items: CandidateItem[] = [];
  for (const tweet of body.data ?? []) {
    const published = new Date(tweet.created_at);
    if (Number.isNaN(published.getTime()) || published.getTime() < cutoff) continue;
    const username = users.get(tweet.author_id) ?? 'unknown';
    items.push({
      sourceName: `@${username}`,
      category: 'social',
      title: tweet.text.slice(0, 280),
      url: `https://x.com/${username}/status/${tweet.id}`,
      publishedAt: published.toISOString(),
      snippet: tweet.text,
    });
  }
  return items;
}

// ── Nitter RSS fallback (free, unreliable) ─────────────────────────────────

const nitterParser = new Parser({
  timeout: 12_000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

let lastGoodInstance: string | null = null;

export async function fetchSocialViaNitter(handle: string): Promise<CandidateItem[]> {
  const instances = lastGoodInstance
    ? [lastGoodInstance, ...NITTER_INSTANCES.filter((i) => i !== lastGoodInstance)]
    : NITTER_INSTANCES;

  let lastError: unknown = new Error('no nitter instance tried');
  for (const instance of instances) {
    try {
      const feed = await nitterParser.parseURL(`${instance}/${handle}/rss`);
      lastGoodInstance = instance;
      return mapNitterItems(handle, feed.items ?? []);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `all nitter instances failed for @${handle}: ${lastError instanceof Error ? lastError.message : lastError}`
  );
}

function mapNitterItems(
  handle: string,
  items: { title?: string; link?: string; isoDate?: string; pubDate?: string; contentSnippet?: string }[]
): CandidateItem[] {
  const cutoff = Date.now() - MAX_AGE_HOURS * 3_600_000;
  const results: CandidateItem[] = [];
  for (const item of items) {
    const text = (item.title ?? '').trim();
    if (!text || text.startsWith('RT by')) continue; // spec query excludes retweets
    const publishedRaw = item.isoDate ?? item.pubDate;
    const published = publishedRaw ? new Date(publishedRaw) : null;
    if (!published || Number.isNaN(published.getTime()) || published.getTime() < cutoff) continue;

    // rewrite nitter link → x.com and drop the #m fragment
    const statusMatch = (item.link ?? '').match(/\/([^/]+)\/status\/(\d+)/);
    if (!statusMatch) continue;
    const url = `https://x.com/${statusMatch[1]}/status/${statusMatch[2]}`;

    results.push({
      sourceName: `@${handle}`,
      category: 'social',
      title: text.slice(0, 280),
      url,
      publishedAt: published.toISOString(),
      snippet: (item.contentSnippet ?? text).slice(0, 500),
    });
    if (results.length >= MAX_PER_HANDLE) break;
  }
  return results;
}
