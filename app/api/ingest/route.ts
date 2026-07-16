import { NextResponse } from 'next/server';
import { runIngest } from '@/lib/ingest';
import { CATEGORIES, type Category } from '@/lib/types';

export const maxDuration = 60;

export async function POST(req: Request) {
  const raw = new URL(req.url).searchParams.get('category');
  const category =
    raw && (CATEGORIES as readonly string[]).includes(raw) ? (raw as Category) : undefined;
  const summary = await runIngest(category);
  return NextResponse.json(summary);
}
