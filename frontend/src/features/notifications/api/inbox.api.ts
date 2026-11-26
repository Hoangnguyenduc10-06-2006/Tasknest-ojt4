import { authenticatedAccessToken } from '../../auth';
import { requestJson } from '../../../shared/api/client';
export type NotificationItem = {
  id: number;
  eventType?: string;
  conversationId?: string | null;
  destinationPath?: string | null;
  projectId: number | null;
  taskId: number | null;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};
export type Inbox = {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  matchingTotal?: number;
  matchingUnreadCount?: number;
  page: number;
  size: number;
};
export async function getInbox(userId: string, page: number, size = 20, category = 'all', unreadOnly = false) {
  const accessToken = await authenticatedAccessToken(userId);
  return requestJson<Inbox>(`/api/notifications/inbox?page=${page}&size=${size}${category !== 'all' ? '&category=' + encodeURIComponent(category) : ''}${unreadOnly ? '&unreadOnly=true' : ''}`, {
    accessToken,
  });
}
export async function markNotificationRead(userId: string, id: number) {
  const accessToken = await authenticatedAccessToken(userId);
  return requestJson<unknown>(`/api/notifications/inbox/${id}/read`, {
    accessToken,
    method: 'PUT',
  });
}
export async function markAllNotificationsRead(userId: string) {
  const accessToken = await authenticatedAccessToken(userId);
  return requestJson<{ updated: number }>(`/api/notifications/inbox/read-all`, {
    accessToken,
    method: 'PUT',
  });
}
