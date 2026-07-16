import { describe, expect, it } from 'vitest';
import { extractSummaries } from '../lib/summarise/parse';

const valid = [
  { id: 'a1', headline: 'OpenAI ships new model', summary: 'One sentence.', category: 'models' },
];

describe('extractSummaries', () => {
  it('parses a clean JSON array', () => {
    expect(extractSummaries(JSON.stringify(valid))).toEqual(valid);
  });

  it('extracts an array wrapped in markdown fences and preamble', () => {
    const raw = 'Here you go:\n```json\n' + JSON.stringify(valid) + '\n```\nDone!';
    expect(extractSummaries(raw)).toEqual(valid);
  });

  it('returns null when there is no array at all', () => {
    expect(extractSummaries('Sorry, I cannot help with that.')).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    expect(extractSummaries('[{"id": "a1", "headline": }]')).toBeNull();
  });

  it('drops entries with missing fields or bad categories', () => {
    const raw = JSON.stringify([
      ...valid,
      { id: 'b2', headline: 'No summary', category: 'models' },
      { id: 'c3', headline: 'Bad category', summary: 'S.', category: 'sports' },
    ]);
    expect(extractSummaries(raw)).toEqual(valid);
  });

  it('returns null when every entry is invalid', () => {
    expect(extractSummaries('[{"foo": 1}]')).toBeNull();
  });

  it('returns null for a non-array JSON value', () => {
    expect(extractSummaries('{"id":"a1"}')).toBeNull();
  });
});
