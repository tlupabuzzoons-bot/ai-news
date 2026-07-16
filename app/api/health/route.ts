import { NextResponse } from 'next/server';
import { countStories, sourceHealth } from '@/lib/db';
import { RSS_SOURCES } from '@/lib/sources';

export async function GET() {
  const sources = (await sourceHealth()).map((s) => ({
    ...s,
    category: s.source.startsWith('@') || s.source === 'X API'
      ? 'social'
      : (RSS_SOURCES.find((r) => r.name === s.source)?.category ?? null),
  }));
  const failing = sources.filter((s) => s.last_status === 'error');
  const lastSuccess = sources
    .map((s) => s.last_success)
    .filter(Boolean)
    .sort()
    .at(-1);

  return NextResponse.json({
    status: failing.length === sources.length && sources.length > 0 ? 'down' : 'ok',
    stories: await countStories(),
    last_successful_run: lastSuccess ?? null,
    failing_sources: failing.length,
    sources,
  });
}
