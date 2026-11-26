import { describe, expect, it } from 'vitest';
import { formatDuration, getElapsedSeconds } from './timer';

describe('timer elapsed time', () => {
  it('catches up after delayed ticks or a suspended tab', () => {
    const startedAt = Date.UTC(2026, 9, 27, 1);
    expect(getElapsedSeconds(startedAt, startedAt + 65_900)).toBe(65);
    expect(getElapsedSeconds(startedAt, startedAt + 3_600_000)).toBe(3600);
  });

  it('does not display negative duration when the clock precedes the snapshot', () => {
    expect(getElapsedSeconds(5000, 4000)).toBe(0);
  });

  it('preserves durations over 24 hours and displays sub-hour estimates accurately', () => {
    expect(formatDuration(25 * 3600 + 61)).toBe('25:01:01');
    expect(formatDuration(15 * 60)).toBe('00:15:00');
  });
});
