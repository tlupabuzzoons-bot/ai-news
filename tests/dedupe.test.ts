import { describe, expect, it } from 'vitest';
import {
  hashUrl,
  HEADLINE_THRESHOLD,
  isFuzzyDuplicate,
  normaliseTitle,
  normaliseUrl,
  titleSimilarity,
} from '../lib/ingest/dedupe';

describe('normaliseUrl', () => {
  it('strips tracking params, www, hash and trailing slash', () => {
    expect(normaliseUrl('https://www.example.com/story/?utm_source=x&utm_medium=rss#frag')).toBe(
      'https://example.com/story'
    );
  });

  it('keeps meaningful query params and sorts them', () => {
    expect(normaliseUrl('https://example.com/a?b=2&a=1')).toBe('https://example.com/a?a=1&b=2');
  });

  it('is case-insensitive', () => {
    expect(normaliseUrl('HTTPS://Example.COM/Story')).toBe(normaliseUrl('https://example.com/story'));
  });

  it('survives invalid URLs', () => {
    expect(normaliseUrl('not a url  ')).toBe('not a url');
  });
});

describe('hashUrl', () => {
  it('produces identical hashes for trivially different links', () => {
    expect(hashUrl('https://www.example.com/story/?utm_source=rss')).toBe(
      hashUrl('https://example.com/story')
    );
  });

  it('produces different hashes for different stories', () => {
    expect(hashUrl('https://example.com/a')).not.toBe(hashUrl('https://example.com/b'));
  });
});

describe('normaliseTitle', () => {
  it('removes diacritics, punctuation and casing', () => {
    expect(normaliseTitle('Umělá inteligence: „revoluce“ v Česku!')).toBe(
      'umela inteligence revoluce v cesku'
    );
  });
});

describe('isFuzzyDuplicate', () => {
  it('catches punctuation/casing variants', () => {
    expect(
      isFuzzyDuplicate('OpenAI launches GPT-6 model today', ['OpenAI Launches GPT-6 Model Today!'])
    ).toBe(true);
  });

  it('catches near-identical titles above the threshold', () => {
    expect(
      isFuzzyDuplicate('OpenAI launches new GPT-6 flagship model today', [
        'OpenAI launches new GPT-6 flagship model',
      ])
    ).toBe(true);
  });

  it('passes genuinely different titles', () => {
    expect(
      isFuzzyDuplicate('OpenAI launches GPT-6', ['Anthropic releases Claude 6 benchmark results'])
    ).toBe(false);
  });

  it('supports a lower threshold for generated headlines', () => {
    const a = 'Thinking Machines releases Inkling model';
    const b = 'Thinking Machines Lab releases Inkling model';
    expect(isFuzzyDuplicate(a, [b])).toBe(false); // default 0.85 misses it
    expect(isFuzzyDuplicate(a, [b], HEADLINE_THRESHOLD)).toBe(true); // headline pass catches it
  });
});

describe('titleSimilarity', () => {
  it('is 1 for identical token sets and 0 for disjoint ones', () => {
    expect(titleSimilarity('alpha beta gamma', 'gamma beta alpha')).toBe(1);
    expect(titleSimilarity('alpha beta gamma', 'delta epsilon zeta')).toBe(0);
  });
});
