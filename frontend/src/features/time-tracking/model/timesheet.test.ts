import { describe, expect, it } from 'vitest';
import type { TimeEntry } from '../../workspace';
import {
  filterTimeEntries,
  fromLocalTime,
  intervalSeconds,
  summarizeTime,
  toLocalTime,
  validateTimeRange,
} from './timesheet';
const now = Date.parse('2026-10-29T15:00:00+07:00');
const entry: TimeEntry = {
  id: 1,
  projectId: 7,
  taskId: 42,
  taskTitle: 'Tích hợp API',
  projectName: 'TaskNest',
  startedAt: '2026-10-29T13:58:00+07:00',
  endedAt: null,
  source: 'TIMER',
  version: 0,
};
describe('time range validation', () => {
  it('detects ranges starting at or after a running timer and spanning its start', () => {
    for (const start of ['13:30:00', '13:58:00', '14:00:00'])
      expect(
        validateTimeRange(
          '2026-10-29T' + start,
          '2026-10-29T14:30:00',
          'Bổ sung',
          [entry],
          now,
        ),
      ).toContain('trùng');
  });
  it('does not confuse another date or an adjacent boundary with overlap', () => {
    expect(
      validateTimeRange(
        '2026-10-28T13:30:00',
        '2026-10-28T14:30:00',
        'Bổ sung',
        [entry],
        now,
      ),
    ).toBeUndefined();
    expect(
      validateTimeRange(
        '2026-10-29T13:00:00',
        '2026-10-29T13:58:00',
        'Bổ sung',
        [entry],
        now,
      ),
    ).toBeUndefined();
  });
  it('detects overlap across projects and ignores only the edited entry', () => {
    const ended = { ...entry, endedAt: '2026-10-29T14:30:00+07:00' };
    expect(
      validateTimeRange(
        '2026-10-29T14:00:00',
        '2026-10-29T14:20:00',
        'Sửa',
        [ended],
        now,
      ),
    ).toContain('trùng');
    expect(
      validateTimeRange(
        '2026-10-29T14:00:00',
        '2026-10-29T14:20:00',
        'Sửa',
        [ended],
        now,
        1,
      ),
    ).toBeUndefined();
  });
  it('rejects blank reasons, future time and reversed or invalid intervals', () => {
    expect(
      validateTimeRange(
        '2026-10-29T12:00:00',
        '2026-10-29T13:00:00',
        ' ',
        [],
        now,
      ),
    ).toContain('Lý do');
    expect(
      validateTimeRange(
        '2026-10-29T14:00:00',
        '2026-10-29T16:00:00',
        'X',
        [],
        now,
      ),
    ).toContain('tương lai');
    expect(
      validateTimeRange(
        '2026-10-29T13:00:00',
        '2026-10-29T12:00:00',
        'X',
        [],
        now,
      ),
    ).toContain('sau');
    expect(
      validateTimeRange('', '2026-10-29T13:00:00', 'X', [], now),
    ).toContain('hợp lệ');
    expect(fromLocalTime('2026-02-31T12:00:00')).toBeNaN();
  });
  it('converts inputs using Vietnam time rather than the device timezone', () => {
    expect(fromLocalTime('2026-10-29T13:30:00')).toBe(
      Date.parse('2026-10-29T06:30:00Z'),
    );
    expect(toLocalTime('2026-10-28T18:05:06Z')).toBe('2026-10-29T01:05:06');
  });
});
describe('timesheet totals and filtering', () => {
  it('splits overnight intervals at Vietnamese day/month/week boundaries', () => {
    const end = Date.parse('2026-11-02T01:00:00+07:00');
    const overnight = {
      ...entry,
      startedAt: '2026-11-01T23:00:00+07:00',
      endedAt: '2026-11-02T01:00:00+07:00',
    };
    expect(summarizeTime([overnight], end)).toEqual([3600, 3600, 7200]);
  });
  it('sums a running session from timestamps without adding the mock duration', () => {
    expect(intervalSeconds(entry, now)).toBe(3720);
    expect(summarizeTime([entry], now)).toEqual([3720, 3720, 3720]);
    expect(summarizeTime([], now)).toEqual([0, 0, 0]);
  });
  it('filters by actual project/task IDs, date intersection, and trimmed search', () => {
    const filters = {
      search: ' tích hợp ',
      projectId: '7',
      taskId: '42',
      fromDate: '2026-10-29',
      toDate: '2026-10-29',
    };
    expect(filterTimeEntries([entry], filters, now)).toEqual([entry]);
    expect(
      filterTimeEntries([entry], { ...filters, projectId: '8' }, now),
    ).toEqual([]);
    expect(
      filterTimeEntries([entry], { ...filters, toDate: '2026-10-28' }, now),
    ).toEqual([]);
  });
});
