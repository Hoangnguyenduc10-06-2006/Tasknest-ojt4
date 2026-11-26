import type { NotificationItem } from '../api/inbox.api';
export function notificationCategory(item: NotificationItem) {
  const type = item.eventType ?? '';
  if (
    type.startsWith('discovery.') ||
    type.startsWith('team.invitation.') ||
    type.startsWith('work.milestone-') ||
    type === 'work.project-awarded'
  )
    return 'discovery';
  if (/comment/.test(type)) return 'comment';
  if (/invitation|join|member/.test(type)) return 'invite';
  if (/warning|deadline|estimate|overdue|alert|due_soon/.test(type))
    return 'warning';
  return 'task';
}
export { notificationDestination } from './notification-destination';
