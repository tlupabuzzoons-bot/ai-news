import { randomUUID } from 'node:crypto';
import pLimit from 'p-limit';
import { insertStory, recordRun, recentTitles } from '../db';
import { RSS_SOURCES } from '../sources';
import type { Category } from '../types';
import { summarisePending, type SummariseSummary } from '../summarise';
import { hashUrl, isFuzzyDuplicate } from './dedupe';
import { fetchFeed, type CandidateItem } from './rss';
import { fetchSocialViaApi, fetchSocialViaNitter, hasXToken, X_HANDLES } from './x';

export interface IngestSummary {
  sources: number;
  ok: number;
  failed: number;
  found: number;
  inserted: number;
  durationMs: number;
  summarise?: SummariseSummary;
}

const FEED_CONCURRENCY = 8;

let running: Promise<IngestSummary> | null = null;

/**
 * Idempotent ingest run. Full runs share one in-flight promise; a
 * category-scoped run (per-column retry) is small and runs independently.
 */
export function runIngest(category?: Category): Promise<IngestSummary> {
  if (category) return doRun(category);
  if (!running) {
    running = doRun().finally(() => {
      running = null;
    });
  }
  return running;
}

interface FetchTask {
  name: string;
  fetch: () => Promise<CandidateItem[]>;
}

/** Spec §4: X API when a token exists; free Nitter mirrors otherwise (unreliable). */
function socialTasks(): FetchTask[] {
  if (hasXToken()) {
    return [{ name: 'X API', fetch: fetchSocialViaApi }];
  }
  console.log(JSON.stringify({ event: 'x_token_missing', fallback: 'nitter-rss' }));
  return X_HANDLES.map((handle) => ({
    name: `@${handle}`,
    fetch: () => fetchSocialViaNitter(handle),
  }));
}

async function doRun(category?: Category): Promise<IngestSummary> {
  const started = Date.now();
  const limit = pLimit(FEED_CONCURRENCY);
  // one shared comparison set for fuzzy title dedupe, grown as we insert
  const seenTitles = new Set(await recentTitles());

  const rss = category ? RSS_SOURCES.filter((s) => s.category === category) : RSS_SOURCES;
  const tasks: FetchTask[] = [
    ...rss.map((source) => ({ name: source.name, fetch: () => fetchFeed(source) })),
    ...(!category || category === 'social' ? socialTasks() : []),
  ];

  const results = await Promise.allSettled(
    tasks.map((task) => limit(() => ingestTask(task, seenTitles)))
  );

  const summary: IngestSummary = {
    sources: tasks.length,
    ok: 0,
    failed: 0,
    found: 0,
    inserted: 0,
    durationMs: Date.now() - started,
  };
  for (const r of results) {
    if (r.status === 'fulfilled') {
      summary.ok++;
      summary.found += r.value.found;
      summary.inserted += r.value.inserted;
    } else {
      summary.failed++; // already logged + recorded inside ingestSource
    }
  }
  summary.summarise = await summarisePending();
  summary.durationMs = Date.now() - started;
  console.log(JSON.stringify({ event: 'ingest_complete', ...summary }));
  return summary;
}

async function ingestTask(
  task: FetchTask,
  seenTitles: Set<string>
): Promise<{ found: number; inserted: number }> {
  const started = Date.now();
  try {
    const items = await task.fetch();
    let inserted = 0;
    for (const item of items) {
      if (await insertCandidate(item, seenTitles)) inserted++;
    }
    const durationMs = Date.now() - started;
    console.log(
      JSON.stringify({ source: task.name, status: 'ok', itemsFound: items.length, inserted, durationMs })
    );
    await recordRun({
      source: task.name,
      status: 'ok',
      items_found: items.length,
      inserted,
      duration_ms: durationMs,
    });
    return { found: items.length, inserted };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    console.log(
      JSON.stringify({ source: task.name, status: 'error', itemsFound: 0, durationMs, error: message })
    );
    await recordRun({
      source: task.name,
      status: 'error',
      items_found: 0,
      inserted: 0,
      duration_ms: durationMs,
      error: message,
    });
    throw err; // surfaces as 'rejected' in allSettled without breaking other sources
  }
}

async function insertCandidate(item: CandidateItem, seenTitles: Set<string>): Promise<boolean> {
  if (isFuzzyDuplicate(item.title, seenTitles)) return false;

  const inserted = await insertStory({
    id: randomUUID(),
    url_hash: hashUrl(item.url), // UNIQUE index makes re-runs no-ops
    category: item.category,
    // placeholder headline/summary until Claude summarisation (Phase 4)
    headline: item.title.length > 90 ? `${item.title.slice(0, 87)}…` : item.title,
    summary: firstSentence(item.snippet),
    source: item.sourceName,
    source_url: item.url,
    published_at: item.publishedAt,
    fetched_at: new Date().toISOString(),
    raw_title: item.title,
    needs_review: 1, // marks "not yet summarised"
  });
  if (inserted) seenTitles.add(item.title);
  return inserted;
}

function firstSentence(text: string): string {
  if (!text) return '';
  const match = text.match(/^[\s\S]{10,180}?[.!?](?=\s|$)/);
  return (match ? match[0] : text.slice(0, 140)).trim();
}
