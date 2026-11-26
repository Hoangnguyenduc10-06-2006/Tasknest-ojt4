import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '../api/inbox.api';
import { notificationDestination } from './notification-destination';

const item: NotificationItem = {
  id: 1, projectId: null, taskId: null, title: 'Thông báo', body: '', createdAt: '2026-11-19T00:00:00Z', readAt: null,
};

describe('shared inbox and popup navigation', () => {
  it('opens the exact chat before considering project/task fallbacks', () => {
    expect(notificationDestination({ ...item, eventType: 'discovery.chat.message', conversationId: '42', projectId: 7, taskId: 9 }))
      .toBe('/messages?conversation=42');
  });
  it.each(['0', '-1', '1&other=2', '//example.com', '', null])('does not interpolate an invalid conversation id: %s', conversationId => {
    expect(notificationDestination({ ...item, eventType: 'discovery.chat.message', conversationId })).toBeUndefined();
  });
  it('routes team and project invitations before generic project links', () => {
    expect(notificationDestination({ ...item, eventType: 'team.invitation.created', projectId: 7 })).toBe('/team-management');
    expect(notificationDestination({ ...item, eventType: 'work.project-invitation.created', projectId: 7 })).toBe('/invitations?tab=invitations');
    expect(notificationDestination({ ...item, eventType: 'work.member_removed', projectId: 7 })).toBe('/invitations?tab=requests');
  });
  it('opens recruitment in team management, including legacy notifications', () => {
    expect(notificationDestination({ ...item, eventType: 'discovery.application.created', destinationPath: '/teams/3?opening=9&application=24' }))
      .toBe('/team-management/3?opening=9&application=24');
    expect(notificationDestination({ ...item, eventType: 'discovery.application.accepted', destinationPath: '/teams?view=applications&application=24' }))
      .toBe('/teams?view=applications&application=24');
  });
  it('opens the specific milestone from a collaboration notification', () => {
    expect(notificationDestination({ ...item, eventType: 'work.milestone-submitted', projectId: 5, destinationPath: '/projects/5?tab=milestones&milestone=9' }))
      .toBe('/projects/5?tab=milestones&milestone=9');
  });
  it('keeps task/project fallback navigation for existing notifications', () => {
    expect(notificationDestination({ ...item, taskId: 9, projectId: 7 })).toBe('/tasks/9');
    expect(notificationDestination({ ...item, projectId: 7 })).toBe('/projects/7');
    expect(notificationDestination(item)).toBeUndefined();
  });
});
