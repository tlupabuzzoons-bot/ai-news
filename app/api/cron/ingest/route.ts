import { NextResponse } from 'next/server';
import { runIngest } from '@/lib/ingest';

/**
 * Vercel Cron entry point (vercel.json). Vercel sends GET with
 * `Authorization: Bearer ${CRON_SECRET}` when the env var is set.
 * Without a configured CRON_SECRET this endpoint refuses to run.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const summary = await runIngest();
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
