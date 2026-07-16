import { NextResponse } from 'next/server';
import { runIngest } from '@/lib/ingest';
import { CATEGORIES, type Category } from '@/lib/types';

export const maxDuration = 60;

const COOLDOWN_MS = 30_000;
const lastRunAt = new Map<string, number>(); // keyed per scope: 'full' | category

/**
 * Manual ingest (Refresh button / per-column retry). Protection against
 * anonymous abuse: same-origin check + a 30s per-scope cooldown. A valid
 * CRON_SECRET bearer bypasses both (for scripts/pingers).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authorized = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;

  if (!authorized) {
    // browser requests from the dashboard carry a same-host origin/referer
    const host = req.headers.get('host');
    const source = req.headers.get('origin') ?? req.headers.get('referer');
    let sameOrigin = false;
    try {
      sameOrigin = Boolean(host && source && new URL(source).host === host);
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const raw = new URL(req.url).searchParams.get('category');
  const category =
    raw && (CATEGORIES as readonly string[]).includes(raw) ? (raw as Category) : undefined;

  const scope = category ?? 'full';
  const now = Date.now();
  if (!authorized && now - (lastRunAt.get(scope) ?? 0) < COOLDOWN_MS) {
    return NextResponse.json({ error: 'cooldown' }, { status: 429 });
  }
  lastRunAt.set(scope, now);

  const summary = await runIngest(category);
  return NextResponse.json(summary);
}
