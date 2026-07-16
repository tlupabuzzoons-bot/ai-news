export const SYSTEM_PROMPT = `You summarise tech news. For each numbered input item, return one object.

Return ONLY a raw JSON array. No markdown fences, no preamble.

[{"id":"<echo input id>","headline":"5-7 word headline","summary":"One sentence, max 20 words.","category":"models|research|industry|tools|social"}]

Rules:
- headline: punchy, specific, no clickbait, no trailing period
- summary: exactly one sentence, factual, max 20 words
- category: classify by primary subject
- Never invent facts not present in the input
- Output length must equal input length`;

export const RETRY_SUFFIX = 'Your last response was not valid JSON. Return only the array.';

export interface BatchItem {
  id: string;
  title: string;
  snippet: string;
  source: string;
}

export function buildBatchPrompt(items: BatchItem[]): string {
  const lines = items.map(
    (item, i) =>
      `${i + 1}. id=${item.id} | source=${item.source} | title=${item.title}${item.snippet ? ` | excerpt=${item.snippet.slice(0, 300)}` : ''}`
  );
  return `Input items:\n${lines.join('\n')}`;
}
