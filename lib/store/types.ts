import type { Story } from '../types';

export interface PendingStory {
  id: string;
  raw_title: string;
  summary: string;
  source: string;
  category: string;
}

export interface IngestRun {
  source: string;
  status: 'ok' | 'error';
  items_found: number;
  inserted: number;
  duration_ms: number;
  error?: string;
}

export interface SourceHealth {
  source: string;
  last_status: 'ok' | 'error';
  last_run: string;
  last_success: string | null;
  last_error: string | null;
}

/** Storage driver contract — sqlite locally, postgres on Vercel. */
export interface Driver {
  listStories(limitPerCategory: number): Promise<Story[]>;
  countStories(): Promise<number>;
  insertStory(story: Story): Promise<boolean>;
  recordRun(run: IngestRun): Promise<void>;
  recentTitles(days: number): Promise<string[]>;
  pendingSummaries(limit: number): Promise<PendingStory[]>;
  applySummary(id: string, headline: string, summary: string, category: string): Promise<void>;
  markSummariseFailed(id: string): Promise<void>;
  sourceHealth(): Promise<SourceHealth[]>;
  /** Generated headlines of visible stories in a category (for paraphrase dedupe). */
  recentHeadlines(category: string, days: number, excludeId: string): Promise<string[]>;
  hideStory(id: string): Promise<void>;
}
