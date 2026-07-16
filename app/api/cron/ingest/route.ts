import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runIngest } from '@/lib/ingest';

export const maxDuration = 60;

function constantTimeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Vercel Cron entry point (vercel.json). Vercel sends GET with
 * `Authorization: Bearer ${CRON_SECRET}` when the env var is set.
 * Without a configured CRON_SECRET this endpoint refuses to run.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  if (!secret || !constantTimeMatch(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const summary = await runIngest();
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
