import { describe, expect, it } from 'vitest';
import { getChatTimestamp, startsChatDayGroup, startsChatTimeGroup } from './chat-time';

const now = new Date('2026-11-19T17:30:00Z'); // 00:30 on 20 November in Vietnam.

describe('chat timestamp labels', () => {
  it('uses the Vietnam calendar day and a 24-hour clock even when UTC is still on the previous day', () => {
    const today = getChatTimestamp('2026-11-19T17:05:07.793421Z', now);
    expect(today).toMatchObject({
      dateTime: '2026-11-19T17:05:07.793Z',
      clock: '00:05',
      timeline: 'Hôm nay, 00:05',
      dayLabel: 'Hôm nay',
      inbox: '00:05',
    });
    expect(today?.exact).toContain('00:05:07');
    expect(today?.exact).toContain('20/11/2026');

    expect(getChatTimestamp('2026-11-19T16:55:00Z', now)).toMatchObject({
      clock: '23:55',
      timeline: 'Hôm qua, 23:55',
      inbox: 'Hôm qua',
    });
  });

  it('formats previous days with a year only when the Vietnam calendar year differs', () => {
    expect(getChatTimestamp('2026-11-10T09:30:00+07:00', now)).toMatchObject({
      dateTime: '2026-11-10T02:30:00.000Z',
      timeline: '10/11, 09:30',
      inbox: '10/11',
    });
    expect(getChatTimestamp('2025-12-30T02:30:00Z', now)).toMatchObject({
      timeline: '30/12/2025, 09:30',
      inbox: '30/12/2025',
    });
    expect(
      getChatTimestamp('2026-12-31T16:30:00Z', new Date('2026-12-31T18:00:00Z')),
    ).toMatchObject({ timeline: 'Hôm qua, 23:30', inbox: 'Hôm qua' });
  });

  it('rejects malformed or impossible dates and timestamps without an offset', () => {
    for (const value of [
      '',
      '2026-11-19',
      '2026-11-19T17:00:00',
      '2026-02-29T17:00:00Z',
      '2026-11-31T17:00:00Z',
      '2026-11-19T25:00:00Z',
      '2026-11-19T17:00:00+24:00',
    ]) {
      expect(getChatTimestamp(value, now)).toBeUndefined();
      expect(startsChatTimeGroup(undefined, value)).toBe(false);
    }
    expect(getChatTimestamp('2024-02-29T17:00:00Z', now)).toBeDefined();
  });
});

describe('chat timeline grouping', () => {
  const first = '2026-11-19T02:30:00Z';

  it('starts at the first valid timestamp, including after invalid input', () => {
    expect(startsChatTimeGroup(undefined, first)).toBe(true);
    expect(startsChatTimeGroup('invalid', first)).toBe(true);
  });

  it('groups adjacent messages until they are at least 15 minutes apart', () => {
    expect(startsChatTimeGroup(first, '2026-11-19T02:44:59.999Z')).toBe(false);
    expect(startsChatTimeGroup(first, '2026-11-19T09:45:00+07:00')).toBe(true);
  });

  it('always starts a new group across midnight in Vietnam', () => {
    expect(startsChatTimeGroup('2026-11-19T16:59:59Z', '2026-11-19T17:00:00Z')).toBe(true);
    expect(startsChatTimeGroup('2026-11-19T23:59:59Z', '2026-11-20T00:00:00Z')).toBe(false);
  });
});

describe('chat day separators', () => {
  it('shows one separator per Vietnam day, not between every nearby message group', () => {
    expect(startsChatDayGroup(undefined, '2026-11-19T16:30:00Z')).toBe(true);
    expect(startsChatDayGroup('2026-11-19T16:30:00Z', '2026-11-19T16:45:00Z')).toBe(false);
    expect(startsChatDayGroup('2026-11-19T16:59:59Z', '2026-11-19T17:00:00Z')).toBe(true);
    expect(startsChatDayGroup('invalid', '2026-11-19T17:05:00Z')).toBe(true);
  });
});
