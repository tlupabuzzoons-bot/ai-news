import { describe, expect, it } from 'vitest';
import { matchesAiKeywords } from '../lib/ingest/rss';
import { mapNitterItems } from '../lib/ingest/x';
import { decodeEntities, isHttpUrl } from '../lib/text';

describe('decodeEntities', () => {
  it('decodes numeric decimal and hex entities', () => {
    expect(decodeEntities('CSAM &#8216;deepfakes&#8217;')).toBe('CSAM ‘deepfakes’');
    expect(decodeEntities('&#x27;quoted&#x27;')).toBe("'quoted'");
  });

  it('decodes common named entities and leaves unknown ones alone', () => {
    expect(decodeEntities('Q&amp;A &mdash; today &unknown;')).toBe('Q&A — today &unknown;');
  });

  it('passes plain text through unchanged', () => {
    expect(decodeEntities('No entities here')).toBe('No entities here');
  });
});

describe('isHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isHttpUrl('https://example.com/a')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
  });

  it('rejects javascript:, data: and garbage', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('data:text/html,x')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });
});

describe('matchesAiKeywords', () => {
  it('matches whole words only', () => {
    expect(matchesAiKeywords('New AI model released')).toBe(true);
    expect(matchesAiKeywords('Fresh air quality report')).toBe(false); // "ai" inside "air"
    expect(matchesAiKeywords('OpenAI announces something')).toBe(true);
  });

  it('matches Czech keywords', () => {
    expect(matchesAiKeywords('Umělá inteligence mění průmysl')).toBe(true);
    expect(matchesAiKeywords('Počasí bude slunečné')).toBe(false);
  });
});

describe('mapNitterItems', () => {
  const fresh = new Date().toISOString();

  it('rewrites nitter links to x.com and keeps the status id', () => {
    const items = mapNitterItems('OpenAI', [
      { title: 'Big launch today', link: 'https://nitter.net/OpenAI/status/12345#m', isoDate: fresh },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://x.com/OpenAI/status/12345');
    expect(items[0].sourceName).toBe('@OpenAI');
    expect(items[0].category).toBe('social');
  });

  it('skips retweets and items without a status link', () => {
    const items = mapNitterItems('OpenAI', [
      { title: 'RT by @OpenAI: something', link: 'https://nitter.net/x/status/1', isoDate: fresh },
      { title: 'No link here', isoDate: fresh },
    ]);
    expect(items).toHaveLength(0);
  });

  it('skips stale items and items without a parseable date', () => {
    const stale = new Date(Date.now() - 72 * 3_600_000).toISOString();
    const items = mapNitterItems('OpenAI', [
      { title: 'Old news', link: 'https://nitter.net/OpenAI/status/2', isoDate: stale },
      { title: 'Dateless', link: 'https://nitter.net/OpenAI/status/3' },
    ]);
    expect(items).toHaveLength(0);
  });
});
