import { backoffMs, MAX_ATTEMPTS, sleep } from '../backoff';
import { extractSummaries, type SummaryResult } from '../parse';
import { buildBatchPrompt, RETRY_SUFFIX, SYSTEM_PROMPT, type BatchItem } from '../prompt';

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

export function isGeminiAvailable(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string; details?: { retryDelay?: string }[] };
}

async function callGemini(input: string): Promise<{ ok: true; text: string } | { ok: false; status: number; retryAfterS?: number }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    }
  );

  if (!res.ok) {
    let retryAfterS: number | undefined;
    const header = res.headers.get('retry-after');
    if (header && !Number.isNaN(Number(header))) retryAfterS = Number(header);
    try {
      const body = (await res.json()) as GeminiResponse;
      const delay = body.error?.details?.find((d) => d.retryDelay)?.retryDelay;
      if (delay) retryAfterS = parseFloat(delay); // e.g. "37s"
    } catch {
      // no parseable body
    }
    return { ok: false, status: res.status, retryAfterS };
  }

  const body = (await res.json()) as GeminiResponse;
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return { ok: true, text };
}

/** Summarise one batch via the Gemini API free tier. Same retry contract as the CLI provider. */
export async function summariseBatchViaGemini(items: BatchItem[]): Promise<SummaryResult[] | null> {
  let jsonRetried = false;
  let input = buildBatchPrompt(items);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let result: Awaited<ReturnType<typeof callGemini>>;
    try {
      result = await callGemini(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(JSON.stringify({ event: 'summarise_gemini_error', attempt, error: message.slice(0, 200) }));
      if (attempt === MAX_ATTEMPTS) return null;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (!result.ok) {
      if (result.status === 404) {
        console.log(
          JSON.stringify({ event: 'gemini_model_not_found', model: GEMINI_MODEL, hint: 'set GEMINI_MODEL env' })
        );
        return null; // model name is wrong — retrying won't help
      }
      console.log(JSON.stringify({ event: 'summarise_gemini_http', attempt, status: result.status }));
      if (result.status === 429 || result.status >= 500) {
        if (attempt === MAX_ATTEMPTS) return null;
        await sleep(backoffMs(attempt, result.retryAfterS));
        continue;
      }
      return null; // 4xx other than 429 won't heal on retry
    }

    const parsed = extractSummaries(result.text);
    if (parsed) return parsed;

    if (!jsonRetried) {
      jsonRetried = true;
      input = `${buildBatchPrompt(items)}\n\n${RETRY_SUFFIX}`;
      continue;
    }
    return null;
  }
  return null;
}
