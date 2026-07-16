import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { Story } from '../types';
import type { Driver, IngestRun, PendingStory, SourceHealth } from './types';

// On Vercel the filesystem is read-only except /tmp — storage is ephemeral
// there (per warm instance) unless DATABASE_URL selects the postgres driver.
const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'brief.db');

const STORY_COLUMNS =
  'id, url_hash, category, headline, summary, source, source_url, published_at, fetched_at, raw_title, needs_review';

export function createDriver(): Driver {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
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
    );
    CREATE INDEX IF NOT EXISTS idx_stories_category_published
      ON stories (category, published_at DESC);
    CREATE TABLE IF NOT EXISTS ingest_runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source      TEXT NOT NULL,
      status      TEXT NOT NULL CHECK (status IN ('ok','error')),
      items_found INTEGER NOT NULL DEFAULT 0,
      inserted    INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      error       TEXT,
      ran_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ingest_runs_source_ran
      ON ingest_runs (source, ran_at DESC);
  `);
  // guarded migrations for DBs created before these columns existed
  const cols = (db.prepare(`PRAGMA table_info(stories)`).all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('summarised')) db.exec(`ALTER TABLE stories ADD COLUMN summarised INTEGER NOT NULL DEFAULT 0`);
  if (!cols.includes('hidden')) db.exec(`ALTER TABLE stories ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0`);

  return {
    async listStories(limitPerCategory) {
      return db
        .prepare(
          `SELECT ${STORY_COLUMNS}
           FROM (
             SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY published_at DESC) AS rn
             FROM stories WHERE hidden = 0
           )
           WHERE rn <= ?
           ORDER BY category, published_at DESC`
        )
        .all(limitPerCategory) as Story[];
    },

    async countStories() {
      return (db.prepare('SELECT COUNT(*) AS n FROM stories').get() as { n: number }).n;
    },

    async insertStory(story) {
      const result = db
        .prepare(
          `INSERT OR IGNORE INTO stories
           (id, url_hash, category, headline, summary, source, source_url, published_at, fetched_at, raw_title, needs_review)
           VALUES (@id, @url_hash, @category, @headline, @summary, @source, @source_url, @published_at, @fetched_at, @raw_title, @needs_review)`
        )
        .run(story);
      return result.changes > 0;
    },

    async recordRun(run) {
      db.prepare(
        `INSERT INTO ingest_runs (source, status, items_found, inserted, duration_ms, error, ran_at)
         VALUES (@source, @status, @items_found, @inserted, @duration_ms, @error, @ran_at)`
      ).run({ error: null, ...run, ran_at: new Date().toISOString() });
    },

    async recentTitles(days) {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      return (
        db.prepare(`SELECT raw_title FROM stories WHERE fetched_at > ?`).all(cutoff) as {
          raw_title: string;
        }[]
      ).map((r) => r.raw_title);
    },

    async pendingSummaries(limit) {
      return db
        .prepare(
          `SELECT id, raw_title, summary, source, category FROM stories
           WHERE summarised = 0 ORDER BY fetched_at ASC LIMIT ?`
        )
        .all(limit) as PendingStory[];
    },

    async applySummary(id, headline, summary, category) {
      db.prepare(
        `UPDATE stories SET headline = ?, summary = ?, category = ?, summarised = 1, needs_review = 0
         WHERE id = ?`
      ).run(headline, summary, category, id);
    },

    async failedSummaries(limit, maxAgeHours) {
      const cutoff = new Date(Date.now() - maxAgeHours * 3_600_000).toISOString();
      return db
        .prepare(
          `SELECT id, raw_title, summary, source, category FROM stories
           WHERE summarised = 1 AND needs_review = 1 AND fetched_at > ?
           ORDER BY fetched_at ASC LIMIT ?`
        )
        .all(cutoff, limit) as PendingStory[];
    },

    async markSummariseFailed(id, final) {
      db.prepare(`UPDATE stories SET summarised = 1, needs_review = ? WHERE id = ?`).run(final ? 2 : 1, id);
    },

    async sourceHealth() {
      return db
        .prepare(
          `SELECT r.source,
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
           ORDER BY r.source`
        )
        .all() as SourceHealth[];
    },

    async recentHeadlines(category, days, excludeId) {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      return (
        db
          .prepare(
            `SELECT headline FROM stories
             WHERE category = ? AND hidden = 0 AND summarised = 1 AND id != ? AND fetched_at > ?`
          )
          .all(category, excludeId, cutoff) as { headline: string }[]
      ).map((r) => r.headline);
    },

    async hideStory(id) {
      db.prepare(`UPDATE stories SET hidden = 1 WHERE id = ?`).run(id);
    },
  };
}
