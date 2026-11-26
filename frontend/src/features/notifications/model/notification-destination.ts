import type { NotificationItem } from '../api/inbox.api';

export function notificationDestination(item: NotificationItem) {
  const destination = item.destinationPath;
  const eventType = item.eventType ?? '';
  if (destination && destination.length <= 512 &&
    /^\/(messages|teams(?:\/[1-9]\d*)?|team-management(?:\/[1-9]\d*)?|requests\/[1-9]\d*|members\/[0-9a-f-]{36}|projects\/[1-9]\d*)(?:\?[a-zA-Z][a-zA-Z0-9]*=[a-zA-Z0-9_-]+(?:&[a-zA-Z][a-zA-Z0-9]*=[a-zA-Z0-9_-]+)*)?$/.test(destination)) {
    if (['discovery.application.created', 'discovery.application.withdrawn'].includes(eventType)) {
      const legacy = destination.match(/^\/teams\/([1-9][0-9]*)(\?opening=[1-9][0-9]*&application=[1-9][0-9]*)$/);
      if (legacy) return '/team-management/' + legacy[1] + legacy[2];
    }
    if (eventType.startsWith('team.invitation.')) {
      if (/^\/team-management(?:\/[1-9][0-9]*)?$/.test(destination)) return destination;
      if (eventType !== 'team.invitation.created' && /^\/teams\/[1-9][0-9]*$/.test(destination))
        return destination.replace('/teams/', '/team-management/');
    }
    if (!eventType.startsWith('team.invitation.')) return destination;
  }
  if (item.eventType === 'discovery.chat.message' && /^[1-9][0-9]*$/.test(item.conversationId ?? ''))
    return `/messages?conversation=${item.conversationId}`;
  if (item.eventType?.startsWith('team.invitation.')) return '/team-management';
  if (item.eventType === 'work.project-invitation.created') return '/invitations?tab=invitations';
  if (['work.member_removed', 'work.join_request_rejected'].includes(item.eventType ?? '')) return '/invitations?tab=requests';
  if (item.taskId) return `/tasks/${item.taskId}`;
  if (item.projectId)
    return '/projects/' + item.projectId + (eventType.startsWith('work.milestone-') ? '?tab=milestones' : '');
  return undefined;
}
