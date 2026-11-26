import type { NotificationItem } from '../api/inbox.api';

export function createNotificationPopupTracker(startedAt = Date.now()) {
  let initialId: number | undefined;
  const observed = new Set<number>();

  return {
    take(items: NotificationItem[]) {
      const firstSnapshot = initialId === undefined;
      const baseline = initialId ?? Math.max(0, ...items.map(item => item.id));
      initialId = baseline;
      return items.filter(item => {
        if (observed.has(item.id)) return false;
        observed.add(item.id);
        // A notification arriving while the first inbox request is in flight
        // still belongs to this session and must produce a popup.
        const arrivedDuringSession = Date.parse(item.createdAt) >= startedAt;
        const newId = !firstSnapshot && item.id > baseline;
        return !item.readAt && (arrivedDuringSession || newId);
      });
    },
  };
}
