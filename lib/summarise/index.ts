import pLimit from 'p-limit';
import { applySummary, hideStory, markSummariseFailed, pendingSummaries, recentHeadlines } from '../db';
import { HEADLINE_THRESHOLD, isFuzzyDuplicate } from '../ingest/dedupe';
import type { Category } from '../types';
import type { BatchItem } from './prompt';
import { isClaudeCliAvailable, summariseBatchViaCli } from './providers/claudeCli';
import { isGeminiAvailable, summariseBatchViaGemini } from './providers/gemini';
import { summariseBatchHeuristic } from './providers/heuristic';

const BATCH_SIZE = 10; // spec §5: one call per 10 stories
const CONCURRENCY = 2; // spec §6: max 2 in-flight model calls
const MAX_PER_RUN = 100;

export type Provider = 'claude-cli' | 'gemini' | 'heuristic';

/** Auto-detect: local Claude CLI (no key) → Gemini free tier → heuristic. Override with SUMMARISER env. */
async function pickProvider(): Promise<Provider> {
  const forced = process.env.SUMMARISER;
  if (forced === 'claude-cli' || forced === 'gemini' || forced === 'heuristic') return forced;
  if (await isClaudeCliAvailable()) return 'claude-cli';
  if (isGeminiAvailable()) return 'gemini';
  return 'heuristic';
}

export interface SummariseSummary {
  pending: number;
  summarised: number;
  failed: number;
  hidden: number;
  provider: Provider;
  durationMs: number;
}

export async function summarisePending(): Promise<SummariseSummary> {
  const started = Date.now();
  const pending = await pendingSummaries(MAX_PER_RUN);
  const provider = await pickProvider();

  if (pending.length === 0) {
    return { pending: 0, summarised: 0, failed: 0, hidden: 0, provider, durationMs: 0 };
  }

  const batches: (BatchItem & { defaultCategory: Category })[][] = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    batches.push(
      pending.slice(i, i + BATCH_SIZE).map((p) => ({
        id: p.id,
        title: p.raw_title,
        snippet: p.summary, // the stored placeholder is the feed excerpt
        source: p.source,
        defaultCategory: p.category as Category,
      }))
    );
  }

  const limit = pLimit(CONCURRENCY);
  let summarised = 0;
  let failed = 0;
  let hidden = 0;

  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        const results =
          provider === 'claude-cli'
            ? await summariseBatchViaCli(batch)
            : provider === 'gemini'
              ? await summariseBatchViaGemini(batch)
              : summariseBatchHeuristic(batch);
        const byId = new Map((results ?? []).map((r) => [r.id, r]));
        for (const item of batch) {
          const r = byId.get(item.id);
          if (r) {
            // 'social' is reserved for the X column; RSS stories keep their source category
            const category =
              r.category === 'social' && !item.source.startsWith('@') ? item.defaultCategory : r.category;
            await applySummary(item.id, r.headline, r.summary, category);
            summarised++;
            // paraphrase dedupe: same story from another outlet → hide this copy
            const others = await recentHeadlines(category, 3, item.id);
            if (isFuzzyDuplicate(r.headline, others, HEADLINE_THRESHOLD)) {
              await hideStory(item.id);
              hidden++;
            }
          } else {
            await markSummariseFailed(item.id); // raw title stays as headline
            failed++;
          }
        }
      })
    )
  );

  const summary: SummariseSummary = {
    pending: pending.length,
    summarised,
    failed,
    hidden,
    provider,
    durationMs: Date.now() - started,
  };
  console.log(JSON.stringify({ event: 'summarise_complete', ...summary }));
  return summary;
}
