export const returnHoldDurationMs = 5_000;

export function returnHoldProgress(elapsedMilliseconds: number): number {
  return Math.max(0, Math.min(1, elapsedMilliseconds / returnHoldDurationMs));
}

export function returnHoldSecondsRemaining(elapsedMilliseconds: number): number {
  return Math.max(0, Math.ceil((returnHoldDurationMs - elapsedMilliseconds) / 1_000));
}
