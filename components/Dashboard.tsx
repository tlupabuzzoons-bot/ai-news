'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { COLUMNS } from '@/lib/columns';
import type { Category, Story } from '@/lib/types';
import { formatClock, formatCountdown } from '@/lib/time';
import Column from './Column';

const POLL_INTERVAL_S = 60;

interface StoriesResponse {
  total: number;
  updated_at: string;
  stories: Story[];
}

interface HealthSource {
  source: string;
  category: Category | null;
  last_status: 'ok' | 'error';
}

export default function Dashboard() {
  const [stories, setStories] = useState<Story[] | null>(null);
  const [failing, setFailing] = useState<Record<string, string[]>>({});
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL_S);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState<Category | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const fetchingRef = useRef(false);
  const prevIdsRef = useRef<Set<string> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const [storiesRes, healthRes] = await Promise.all([
        fetch('/api/stories', { cache: 'no-store' }),
        fetch('/api/health', { cache: 'no-store' }).catch(() => null),
      ]);
      if (!storiesRes.ok) return;
      const data: StoriesResponse = await storiesRes.json();

      // diff against the previous poll — new stories get a ~2s highlight
      const ids = new Set(data.stories.map((s) => s.id));
      if (prevIdsRef.current) {
        const fresh = data.stories.filter((s) => !prevIdsRef.current!.has(s.id)).map((s) => s.id);
        if (fresh.length > 0) {
          setNewIds(new Set(fresh));
          if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
          fadeTimerRef.current = setTimeout(() => setNewIds(new Set()), 2_500);
        }
      }
      prevIdsRef.current = ids;

      setStories(data.stories);
      setUpdatedAt(new Date(data.updated_at));

      if (healthRes?.ok) {
        const health = (await healthRes.json()) as { sources: HealthSource[] };
        const byCategory: Record<string, string[]> = {};
        for (const s of health.sources) {
          if (s.last_status === 'error' && s.category) {
            (byCategory[s.category] ??= []).push(s.source);
          }
        }
        setFailing(byCategory);
      }
    } catch {
      // keep showing last good data
    } finally {
      fetchingRef.current = false;
      setCountdown(POLL_INTERVAL_S);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // one shared 1s tick: countdown + live relative timestamps
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setCountdown((c) => {
        if (c <= 1) {
          load();
          return POLL_INTERVAL_S;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  const manualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/ingest', { method: 'POST' });
    } catch {
      // ingest failure still falls through to a reload of cached stories
    }
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const retryCategory = useCallback(
    async (category: Category) => {
      setRetrying(category);
      try {
        await fetch(`/api/ingest?category=${category}`, { method: 'POST' });
        await load();
      } catch {
        // error state stays visible; user can retry again
      } finally {
        setRetrying(null);
      }
    },
    [load]
  );

  const total = stories?.length ?? 0;
  // empty DB means ingest is filling in the background — keep the skeleton up
  const coldStart = stories === null || stories.length === 0;

  return (
    <div className="min-h-screen bg-[#070c18] px-5 py-5 text-[#e2e8f0]">
      <header className="mb-5 flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#0ea5e9)' }}
          aria-hidden
        >
          ai
        </div>
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold leading-tight">AI daily brief</h1>
          <p className="text-[11px] tabular-nums text-[#64748b]">
            {total} stories · updated {updatedAt ? formatClock(updatedAt) : '—'} · next{' '}
            {formatCountdown(countdown)}
          </p>
        </div>
        <button
          onClick={manualRefresh}
          disabled={refreshing}
          className="ml-auto rounded-lg px-3 py-1.5 text-[11.5px] font-medium text-[#a5b4fc] transition-opacity disabled:opacity-40"
          style={{ background: 'rgba(99,102,241,0.12)' }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <main className="flex gap-4 overflow-x-auto pb-3">
        {COLUMNS.filter(
          // spec §4: degrade gracefully — hide the social column while it has no data
          (def) => def.key !== 'social' || coldStart || stories.some((s) => s.category === 'social')
        ).map((def) =>
          coldStart ? (
            <SkeletonColumn key={def.key} label={def.label} accent={def.accent} dark={def.dark} />
          ) : (
            <Column
              key={def.key}
              def={def}
              stories={stories.filter((s) => s.category === def.key)}
              now={now}
              newIds={newIds}
              failingSources={failing[def.key] ?? []}
              retrying={retrying === def.key}
              onRetry={() => retryCategory(def.key)}
            />
          )
        )}
      </main>
    </div>
  );
}

function SkeletonColumn({ label, accent, dark }: { label: string; accent: string; dark: string }) {
  return (
    <section className="min-w-[230px] flex-1 overflow-hidden rounded-xl border border-[#0f1e35] bg-[#0c1628]">
      <header
        className="px-3.5 py-2.5"
        style={{ background: `linear-gradient(135deg, ${dark}88, #0c1628)` }}
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: accent }}>
          {label}
        </h2>
      </header>
      <div className="divide-y divide-[#0f1e35]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse px-3.5 py-3">
            <div className="h-3 w-11/12 rounded bg-[#0f1e35]" />
            <div className="mt-2 h-2.5 w-full rounded bg-[#0f1e35]/70" />
            <div className="mt-1 h-2.5 w-2/3 rounded bg-[#0f1e35]/70" />
            <div className="mt-2.5 h-4 w-20 rounded-full bg-[#0f1e35]/50" />
          </div>
        ))}
      </div>
    </section>
  );
}
