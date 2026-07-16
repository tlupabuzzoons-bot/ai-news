import { describe, expect, it } from 'vitest';
import { backoffMs, MAX_ATTEMPTS } from '../lib/summarise/backoff';

const noJitter = () => 0.5; // random()=0.5 → jitter factor exactly 1

describe('backoffMs', () => {
  it('follows the 2s → 4s → 8s → 16s → 32s schedule', () => {
    expect(backoffMs(1, undefined, noJitter)).toBe(2_000);
    expect(backoffMs(2, undefined, noJitter)).toBe(4_000);
    expect(backoffMs(3, undefined, noJitter)).toBe(8_000);
    expect(backoffMs(4, undefined, noJitter)).toBe(16_000);
    expect(backoffMs(5, undefined, noJitter)).toBe(32_000);
  });

  it('caps at the 5th step', () => {
    expect(backoffMs(9, undefined, noJitter)).toBe(32_000);
    expect(MAX_ATTEMPTS).toBe(5);
  });

  it('applies at most ±20% jitter', () => {
    expect(backoffMs(3, undefined, () => 0)).toBe(8_000 * 0.8);
    expect(backoffMs(3, undefined, () => 1)).toBe(8_000 * 1.2);
    for (let i = 0; i < 50; i++) {
      const ms = backoffMs(2);
      expect(ms).toBeGreaterThanOrEqual(4_000 * 0.8);
      expect(ms).toBeLessThanOrEqual(4_000 * 1.2);
    }
  });

  it('lets retry-after override the schedule, without jitter', () => {
    expect(backoffMs(1, 37, noJitter)).toBe(37_000);
    expect(backoffMs(5, 2, () => 0)).toBe(2_000);
  });

  it('ignores non-positive retry-after values', () => {
    expect(backoffMs(1, 0, noJitter)).toBe(2_000);
    expect(backoffMs(1, -5, noJitter)).toBe(2_000);
  });
});
