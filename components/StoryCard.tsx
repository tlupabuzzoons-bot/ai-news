'use client';

import { memo } from 'react';
import type { Story } from '@/lib/types';
import { relativeTime } from '@/lib/time';

interface Props {
  story: Story;
  now: number;
  isNew?: boolean;
}

function StoryCard({ story, now, isNew }: Props) {
  return (
    <article className={`story-card px-3.5 py-3 ${isNew ? 'story-new' : ''}`}>
      <a
        href={story.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="story-headline block text-[12.5px] font-medium leading-snug text-[#e2e8f0] transition-colors duration-150"
      >
        {story.headline}
      </a>
      <p className="mt-1 text-[11.5px] leading-[1.6] text-[#64748b]">{story.summary}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <a
          href={story.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="source-badge inline-flex max-w-[70%] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
        >
          <span className="truncate">{story.source}</span>
          <span aria-hidden className="shrink-0 text-[9px]">↗</span>
        </a>
        <time
          dateTime={story.published_at}
          className="shrink-0 text-[10px] tabular-nums text-[#334155]"
          title={new Date(story.published_at).toLocaleString()}
        >
          {relativeTime(story.published_at, now)}
        </time>
      </div>
    </article>
  );
}

export default memo(StoryCard);
