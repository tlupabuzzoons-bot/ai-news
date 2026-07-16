import { NextResponse } from 'next/server';
import { countStories, listStories } from '@/lib/db';
import { runIngest } from '@/lib/ingest';

export const maxDuration = 60;

export async function GET() {
  // ephemeral storage cold start (Vercel /tmp): kick off a fill in the
  // background; the client polls every 60s and picks the stories up.
  if ((await countStories()) === 0) {
    runIngest().catch((err) =>
      console.log(JSON.stringify({ event: 'coldstart_ingest_failed', error: String(err).slice(0, 200) }))
    );
  }
  const stories = await listStories();
  return NextResponse.json({
    total: stories.length,
    updated_at: new Date().toISOString(),
    stories,
  });
}
