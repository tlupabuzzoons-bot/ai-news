export const MAX_ATTEMPTS = 5;

/**
 * Exponential backoff per spec §6: 2s → 4s → 8s → 16s → 32s with ±20% jitter.
 * A server-provided retry-after (seconds) takes precedence over the schedule.
 * `random` is injectable for deterministic tests.
 */
export function backoffMs(attempt: number, retryAfterSeconds?: number, random: () => number = Math.random): number {
  if (retryAfterSeconds && retryAfterSeconds > 0) return retryAfterSeconds * 1000;
  const capped = Math.min(Math.max(attempt, 1), MAX_ATTEMPTS);
  const base = 2 ** capped * 1000; // 2s, 4s, 8s, 16s, 32s
  const jitter = 1 + (random() * 2 - 1) * 0.2; // ±20%
  return Math.round(base * jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
