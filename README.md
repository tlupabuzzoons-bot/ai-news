# AI Daily Brief

Self-hosted dashboard that continuously ingests AI/tech news (RSS + X), summarises every story
into one short headline + one sentence with Claude, and renders them in colour-coded columns,
newest → oldest.

```
[cron: every 20 min]
      ↓
  fetchers (RSS feeds + X via API or Nitter mirrors)
      ↓
  dedupe (URL hash + fuzzy title match)
      ↓
  summarise (batched, 10 stories per model call)
      ↓
  SQLite / Postgres: stories table
      ↓
[GET /api/stories]  ← client polls every 60s
      ↓
  React dashboard (renders instantly from cache)
```

Ingestion is fully decoupled from rendering — the frontend never calls a model and never waits
on a fetch.

## Setup

```bash
npm install
npm run dev
```

That's it. On first boot the server ingests all sources automatically (~1 min with Claude
summarisation). **No API key is required** — see providers below.

## Summarisation providers (auto-detected)

| Provider | Requirement | Notes |
|---|---|---|
| `claude-cli` | `claude` CLI on PATH, logged in | Uses your Claude subscription — no API key. Local default. |
| `gemini` | `GEMINI_API_KEY` (free tier) | https://aistudio.google.com/apikey — the free path for Vercel. |
| `heuristic` | nothing | Cleaned title + first sentence, source-default category. Last resort. |

Force one with `SUMMARISER=claude-cli|gemini|heuristic`.

## Environment variables (all optional)

See `.env.example`. `CRON_SECRET` protects `/api/cron/ingest` (required for Vercel Cron);
`X_BEARER_TOKEN` switches the social column from Nitter mirrors to the real X API v2 (~$100/mo);
`DATABASE_URL` switches storage from SQLite to Postgres.

## Adding a source

Add one entry to `RSS_SOURCES` in `lib/sources.ts`:

```ts
{ name: 'My Feed', url: 'https://example.com/feed', category: 'tools', aiFilter: true },
```

- `category` — fallback column before Claude classifies
- `aiFilter` — apply the AI keyword allowlist (for general-news feeds); AI-only feeds set `false`
- `maxPerRun` — optional cap per run (default 25; arXiv feeds use 10)

X handles live in `X_HANDLES` in `lib/ingest/x.ts`.

## API

- `GET /api/stories` — the dashboard's data source (per-category cap 50, hidden dupes excluded)
- `POST /api/ingest` — manual run; `?category=models` re-runs only that column's sources.
  Same-origin only, 30s cooldown per scope (a `CRON_SECRET` bearer bypasses both)
- `GET /api/cron/ingest` — scheduler entry, requires `Authorization: Bearer $CRON_SECRET`
- `GET /api/health` — last run / last success / last error per source

Failed summarisations (`needs_review=1`) get exactly one retry on a later idle run;
a second failure marks them final (`needs_review=2`), keeping the raw title as headline.
Note: with multiple serverless instances sharing one Postgres, cron + manual runs on
different instances can occasionally double-summarise a batch (bounded token waste,
no data corruption).

## Dedupe

1. sha256 over a normalised URL (tracking params, www, trailing slash stripped) — UNIQUE index
2. fuzzy raw-title match (token Jaccard ≥ 0.85, diacritics-insensitive) against the last 3 days
3. after summarisation: generated-headline match (≥ 0.72) per category hides cross-outlet
   paraphrases of the same story

## Tests

```bash
npm test   # vitest: dedupe, JSON-parse fallback, backoff timing
```

## Deploying to Vercel

```bash
vercel --prod
```

Storage on Vercel:

- **Zero-config (default)** — SQLite in `/tmp`: ephemeral per warm instance; the first request
  after a cold start triggers a background re-ingest (skeleton shows meanwhile). Fine for
  personal use.
- **Durable** — set `DATABASE_URL` to any Postgres (e.g. free Neon via Vercel Marketplace);
  the schema creates itself.

Also set on Vercel:

- `CRON_SECRET` — required, protects the cron endpoint (Vercel sends it automatically)
- `GEMINI_API_KEY` — recommended; without it summaries fall back to the heuristic (the Claude
  CLI doesn't exist on Vercel)

`vercel.json` schedules `/api/cron/ingest` every 20 minutes — that needs a **Pro** plan.
On Hobby (daily cron limit) either change the schedule to `0 6 * * *` or point a free external
pinger (e.g. cron-job.org) at the endpoint with the bearer header every 20 min.

## Known limitations

- Nitter mirrors are unreliable by nature; the social column hides itself when they're all down.
- The Anthropic blog has no public RSS feed (needs a scraper — TODO).
- The AI keyword allowlist (spec-mandated, includes `model`/`agent`) occasionally lets a
  borderline story through; the classifier usually files it sensibly.
