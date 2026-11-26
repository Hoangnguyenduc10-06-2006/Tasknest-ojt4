import { describe, expect, it } from 'vitest';
import { reportPeriodError } from './report';

describe('report date range', () => {
  it('includes both boundary dates and accepts a leap day', () => {
    expect(reportPeriodError('2024-02-29', '2024-02-29')).toBeUndefined();
    expect(reportPeriodError('2024-01-01', '2024-12-31')).toBeUndefined();
    expect(reportPeriodError('2024-01-01', '2025-01-01')).toContain('366');
  });
  it('rejects missing, invalid, impossible and reversed dates', () => {
    for (const from of ['', 'not-a-date', '2026-02-30', '2026-2-01']) {
      expect(reportPeriodError(from, '2026-11-04')).toBeDefined();
    }
    expect(reportPeriodError('2026-11-05', '2026-11-04')).toContain('sau');
  });
});
