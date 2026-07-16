import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { backoffMs, MAX_ATTEMPTS, sleep } from '../backoff';
import { extractSummaries, type SummaryResult } from '../parse';
import { buildBatchPrompt, RETRY_SUFFIX, SYSTEM_PROMPT, type BatchItem } from '../prompt';

const execFileAsync = promisify(execFile);

const CLI_TIMEOUT_MS = 120_000;

let cliAvailable: boolean | null = null;

/** True when the authenticated Claude Code CLI is on PATH (no API key needed). */
export async function isClaudeCliAvailable(): Promise<boolean> {
  if (cliAvailable !== null) return cliAvailable;
  try {
    await execFileAsync('claude', ['--version'], { timeout: 10_000 });
    cliAvailable = true;
  } catch {
    cliAvailable = false;
  }
  return cliAvailable;
}

async function callCliWithInput(input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'claude',
      ['-p', SYSTEM_PROMPT, '--output-format', 'json', '--model', 'sonnet'],
      { timeout: CLI_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        try {
          const envelope = JSON.parse(stdout) as { is_error?: boolean; result?: string };
          if (envelope.is_error || typeof envelope.result !== 'string') {
            return reject(new Error('claude CLI returned an error envelope'));
          }
          resolve(envelope.result);
        } catch (e) {
          reject(e);
        }
      }
    );
    child.stdin?.write(input);
    child.stdin?.end();
  });
}

/**
 * Summarise one batch via the Claude Code CLI.
 * - invalid JSON → one retry with the spec's "not valid JSON" nudge
 * - transient CLI failure → exponential backoff, max 5 attempts
 * Returns null when the batch could not be summarised (caller falls back).
 */
export async function summariseBatchViaCli(items: BatchItem[]): Promise<SummaryResult[] | null> {
  let jsonRetried = false;
  let input = buildBatchPrompt(items);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let raw: string;
    try {
      raw = await callCliWithInput(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(JSON.stringify({ event: 'summarise_cli_error', attempt, error: message.slice(0, 200) }));
      if (attempt === MAX_ATTEMPTS) return null;
      await sleep(backoffMs(attempt));
      continue;
    }

    const parsed = extractSummaries(raw);
    if (parsed) return parsed;

    // spec §5: retry exactly once with the JSON complaint appended
    if (!jsonRetried) {
      jsonRetried = true;
      input = `${buildBatchPrompt(items)}\n\n${RETRY_SUFFIX}`;
      continue;
    }
    return null;
  }
  return null;
}
