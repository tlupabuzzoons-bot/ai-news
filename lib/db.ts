import type { Story } from './types';
import type { Driver, IngestRun, PendingStory, SourceHealth } from './store/types';

export type { IngestRun, PendingStory, SourceHealth };

let driverPromise: Promise<Driver> | null = null;

/** Postgres when DATABASE_URL/POSTGRES_URL is set, sqlite otherwise. */
function driver(): Promise<Driver> {
  if (!driverPromise) {
    const usePg = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
    driverPromise = usePg
      ? import('./store/postgres').then((m) => m.createDriver())
      : import('./store/sqlite').then((m) => m.createDriver());
  }
  return driverPromise;
}

export async function listStories(limitPerCategory = 50): Promise<Story[]> {
  return (await driver()).listStories(limitPerCategory);
}

export async function countStories(): Promise<number> {
  return (await driver()).countStories();
}

export async function insertStory(story: Story): Promise<boolean> {
  return (await driver()).insertStory(story);
}

export async function recordRun(run: IngestRun): Promise<void> {
  return (await driver()).recordRun(run);
}

export async function recentTitles(days = 3): Promise<string[]> {
  return (await driver()).recentTitles(days);
}

export async function pendingSummaries(limit = 100): Promise<PendingStory[]> {
  return (await driver()).pendingSummaries(limit);
}

export async function failedSummaries(limit = 20, maxAgeHours = 24): Promise<PendingStory[]> {
  return (await driver()).failedSummaries(limit, maxAgeHours);
}

export async function applySummary(
  id: string,
  headline: string,
  summary: string,
  category: string
): Promise<void> {
  return (await driver()).applySummary(id, headline, summary, category);
}

export async function markSummariseFailed(id: string, final = false): Promise<void> {
  return (await driver()).markSummariseFailed(id, final);
}

export async function sourceHealth(): Promise<SourceHealth[]> {
  return (await driver()).sourceHealth();
}

export async function recentHeadlines(category: string, days = 3, excludeId = ''): Promise<string[]> {
  return (await driver()).recentHeadlines(category, days, excludeId);
}

export async function hideStory(id: string): Promise<void> {
  return (await driver()).hideStory(id);
}
