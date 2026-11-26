import { describe, expect, it } from 'vitest';
import { notificationCategory, notificationDestination } from './notification-navigation';
import type { NotificationItem } from '../api/inbox.api';
const item: NotificationItem = { id: 1, projectId: null, taskId: null, title: 'Thông báo', body: '', createdAt: '2026-11-19T00:00:00Z', readAt: null };
describe('discovery notification navigation', () => {
  it.each(['/messages?conversation=12', '/requests/8?proposal=12&discussion=1', '/teams/3?opening=9&application=24', '/teams?view=applications&application=24', '/projects/5?tab=milestones&milestone=9', '/members/00000000-0000-4000-8000-000000000001'])('opens the specific authorized screen: %s', path => {
    expect(notificationDestination({ ...item, destinationPath: path })).toBe(path);
  });
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/teams/../admin', '/requests/1?redirect=https://evil.test', '/requests/1%0a', '/login'])('ignores untrusted destination: %s', path => {
    expect(notificationDestination({ ...item, destinationPath: path })).toBeUndefined();
  });
  it('retains existing workspace notifications and groups discovery workflows', () => {
    expect(notificationDestination({ ...item, taskId: 7 })).toBe('/tasks/7');
    expect(notificationDestination({ ...item, eventType: 'work.milestone-plan', projectId: 3 })).toBe('/projects/3?tab=milestones');
    expect(notificationDestination({ ...item, eventType: 'team.invitation.created' })).toBe('/team-management');
    expect(notificationCategory({ ...item, eventType: 'discovery.discussion.message' })).toBe('discovery');
    expect(notificationCategory({ ...item, eventType: 'team.invitation.accepted' })).toBe('discovery');
    expect(notificationCategory({ ...item, eventType: 'task.comment.created' })).toBe('comment');
  });
});
