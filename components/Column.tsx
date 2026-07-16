'use client';

import type { ColumnDef } from '@/lib/columns';
import type { Story } from '@/lib/types';
import StoryCard from './StoryCard';

interface Props {
  def: ColumnDef;
  stories: Story[];
  now: number;
  newIds?: Set<string>;
  failingSources?: string[];
  retrying?: boolean;
  onRetry?: () => void;
}

export default function Column({ def, stories, now, newIds, failingSources = [], retrying, onRetry }: Props) {
  return (
    <section
      className="flex min-w-[230px] flex-1 flex-col overflow-hidden rounded-xl border border-[#0f1e35] bg-[#0c1628]"
      style={{ '--accent': def.accent } as React.CSSProperties}
    >
      <header
        className="flex items-center justify-between px-3.5 py-2.5"
        style={{ background: `linear-gradient(135deg, ${def.dark}88, #0c1628)` }}
      >
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: def.accent }}>
          {def.label}
        </h2>
        <span className="flex items-center gap-1.5 text-[10px] tabular-nums text-[#334155]">
          {failingSources.length > 0 && (
            <span title={`Failing: ${failingSources.join(', ')}`} className="text-[#f59e0b]">
              ⚠ {failingSources.length}
            </span>
          )}
          {stories.length}
        </span>
      </header>
      <div className="column-scroll max-h-[70vh] divide-y divide-[#0f1e35] overflow-y-auto">
        {stories.length === 0 ? (
          failingSources.length > 0 ? (
            <div className="px-3.5 py-6 text-center">
              <p className="text-[11px] text-[#f59e0b]">
                {failingSources.length} source{failingSources.length > 1 ? 's' : ''} failing
              </p>
              <p className="mt-1 truncate text-[10px] text-[#334155]" title={failingSources.join(', ')}>
                {failingSources.join(', ')}
              </p>
              <button
                onClick={onRetry}
                disabled={retrying}
                className="mt-3 rounded-md px-3 py-1 text-[10.5px] font-medium disabled:opacity-40"
                style={{
                  color: def.accent,
                  background: `color-mix(in srgb, ${def.accent} 14%, transparent)`,
                }}
              >
                {retrying ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          ) : (
            <p className="px-3.5 py-6 text-center text-[11px] text-[#334155]">No stories yet</p>
          )
        ) : (
          stories.map((s) => <StoryCard key={s.id} story={s} now={now} isNew={newIds?.has(s.id)} />)
        )}
      </div>
    </section>
  );
}
