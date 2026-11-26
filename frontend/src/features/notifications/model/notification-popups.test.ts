import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '../api/inbox.api';
import { createNotificationPopupTracker } from './notification-popups';

const startedAt = Date.parse('2026-11-19T12:00:00Z');
function notification(id: number, createdAt = '2026-11-19T12:00:01Z'): NotificationItem {
  return { id, createdAt, title: 'New notification', body: '', projectId: null, taskId: null, readAt: null };
}

describe('notification popups', () => {
  it('shows notifications arriving during the first request, excluding old unread items', () => {
    const tracker = createNotificationPopupTracker(startedAt);
    const old = notification(1, '2026-11-18T12:00:00Z');
    const incoming = notification(2);
    expect(tracker.take([incoming, old])).toEqual([incoming]);
    expect(tracker.take([incoming, old])).toEqual([]);
  });

  it('shows new inbox events once across repeated realtime syncs', () => {
    const tracker = createNotificationPopupTracker(startedAt);
    expect(tracker.take([])).toEqual([]);
    for (const [index, eventType] of ['work.task.assigned', 'work.task.reviewed', 'chat.message.created'].entries()) {
      const item = { ...notification(index + 1), eventType };
      expect(tracker.take([item])).toEqual([item]);
      expect(tracker.take([item])).toEqual([]);
    }
  });

  it('does not replay older notifications when the inbox page size increases', () => {
    const tracker = createNotificationPopupTracker(startedAt);
    tracker.take([notification(20, '2026-11-18T12:00:00Z')]);
    expect(tracker.take([notification(19, '2026-11-18T12:00:00Z')])).toEqual([]);
  });

  it('ignores notifications already read and isolates another recipient', () => {
    const tracker = createNotificationPopupTracker(startedAt);
    const item = notification(1);
    expect(tracker.take([{ ...item, readAt: item.createdAt }])).toEqual([]);
    expect(createNotificationPopupTracker(startedAt).take([item])).toEqual([item]);
  });
});
