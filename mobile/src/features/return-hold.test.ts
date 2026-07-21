import { describe, expect, it } from 'vitest';

import {
  returnHoldDurationMs,
  returnHoldProgress,
  returnHoldSecondsRemaining,
} from './return-hold';

describe('full-screen game return hold', () => {
  it('requires five continuous seconds', () => {
    expect(returnHoldDurationMs).toBe(5_000);
    expect(returnHoldSecondsRemaining(0)).toBe(5);
    expect(returnHoldSecondsRemaining(1_000)).toBe(4);
    expect(returnHoldSecondsRemaining(4_999)).toBe(1);
    expect(returnHoldSecondsRemaining(5_000)).toBe(0);
  });

  it('clamps visual progress between zero and one', () => {
    expect(returnHoldProgress(-100)).toBe(0);
    expect(returnHoldProgress(2_500)).toBe(0.5);
    expect(returnHoldProgress(6_000)).toBe(1);
  });
});
