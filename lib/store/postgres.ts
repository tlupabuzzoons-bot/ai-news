import postgres from 'postgres';
import type { Story } from '../types';
import type { Driver, PendingStory, SourceHealth } from './types';

const STORY_COLUMNS =
  'id, url_hash, category, headline, summary, source, source_url, published_at, fetched_at, raw_title, needs_review';

export async function createDriver(): Promise<Driver> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  await sql`
    CREATE TABLE IF NOT EXISTS stories (
      id           TEXT PRIMARY KEY,
      url_hash     TEXT NOT NULL UNIQUE,
      category     TEXT NOT NULL CHECK (category IN ('models','research','industry','tools','social')),
      headline     TEXT NOT NULL,
      summary      TEXT NOT NULL,
      source       TEXT NOT NULL,
      source_url   TEXT NOT NULL,
      published_at TEXT NOT NULL,
      fetched_at   TEXT NOT NULL,
      raw_title    TEXT NOT NULL,
      needs_review INTEGER NOT NULL DEFAULT 0,
      summarised   INTEGER NOT NULL DEFAULT 0,
      hidden       INTEGER NOT NULL DEFAULT 0
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_stories_category_published
    ON stories (category, published_at DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS ingest_runs (
      id          SERIAL PRIMARY KEY,
      source      TEXT NOT NULL,
      status      TEXT NOT NULL CHECK (status IN ('ok','error')),
      items_found INTEGER NOT NULL DEFAULT 0,
      inserted    INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      error       TEXT,
      ran_at      TEXT NOT NULL
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ingest_runs_source_ran
    ON ingest_runs (source, ran_at DESC)`;

  return {
    async listStories(limitPerCategory) {
      return (await sql.unsafe(
        `SELECT ${STORY_COLUMNS}
         FROM (
           SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY published_at DESC) AS rn
           FROM stories WHERE hidden = 0
         ) t
         WHERE rn <= $1
         ORDER BY category, published_at DESC`,
        [limitPerCategory]
      )) as unknown as Story[];
    },

    async countStories() {
      const rows = await sql`SELECT COUNT(*)::int AS n FROM stories`;
      return rows[0].n as number;
    },

    async insertStory(s) {
      const result = await sql`
        INSERT INTO stories (id, url_hash, category, headline, summary, source, source_url, published_at, fetched_at, raw_title, needs_review)
        VALUES (${s.id}, ${s.url_hash}, ${s.category}, ${s.headline}, ${s.summary}, ${s.source}, ${s.source_url}, ${s.published_at}, ${s.fetched_at}, ${s.raw_title}, ${s.needs_review})
        ON CONFLICT (url_hash) DO NOTHING`;
      return result.count > 0;
    },

    async recordRun(run) {
      await sql`
        INSERT INTO ingest_runs (source, status, items_found, inserted, duration_ms, error, ran_at)
        VALUES (${run.source}, ${run.status}, ${run.items_found}, ${run.inserted}, ${run.duration_ms}, ${run.error ?? null}, ${new Date().toISOString()})`;
    },

    async recentTitles(days) {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const rows = await sql`SELECT raw_title FROM stories WHERE fetched_at > ${cutoff}`;
      return rows.map((r) => r.raw_title as string);
    },

    async pendingSummaries(limit) {
      return (await sql`
        SELECT id, raw_title, summary, source, category FROM stories
        WHERE summarised = 0 ORDER BY fetched_at ASC LIMIT ${limit}`) as unknown as PendingStory[];
    },

    async applySummary(id, headline, summary, category) {
      await sql`
        UPDATE stories SET headline = ${headline}, summary = ${summary}, category = ${category},
          summarised = 1, needs_review = 0
        WHERE id = ${id}`;
    },

    async markSummariseFailed(id) {
      await sql`UPDATE stories SET summarised = 1, needs_review = 1 WHERE id = ${id}`;
    },

    async sourceHealth() {
      return (await sql`
        SELECT r.source,
               r.status AS last_status,
               r.ran_at AS last_run,
               r.error  AS last_error,
               s.last_success
        FROM ingest_runs r
        JOIN (
          SELECT source,
                 MAX(id) AS max_id,
                 MAX(CASE WHEN status = 'ok' THEN ran_at END) AS last_success
          FROM ingest_runs GROUP BY source
        ) s ON r.source = s.source AND r.id = s.max_id
        ORDER BY r.source`) as unknown as SourceHealth[];
    },

    async recentHeadlines(category, days, excludeId) {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const rows = await sql`
        SELECT headline FROM stories
        WHERE category = ${category} AND hidden = 0 AND summarised = 1
          AND id != ${excludeId} AND fetched_at > ${cutoff}`;
      return rows.map((r) => r.headline as string);
    },

    async hideStory(id) {
      await sql`UPDATE stories SET hidden = 1 WHERE id = ${id}`;
    },
  };
}
