export const CATEGORIES = ['models', 'research', 'industry', 'tools', 'social'] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Story {
  id: string;
  url_hash: string;
  category: Category;
  headline: string;
  summary: string;
  source: string;
  source_url: string;
  published_at: string; // ISO8601 — real publish time
  fetched_at: string; // ISO8601
  raw_title: string;
  /** 0 = summarised OK, 1 = failed once (retryable), 2 = failed twice (final) */
  needs_review: number;
}
