import type { DirectInvitation } from './invitation.types';

/** Pending invitations in archived projects remain history, not actionable items. */
export function countActionableInvitations(
  invitations: readonly Pick<DirectInvitation, 'status' | 'projectArchived'>[],
): number {
  return invitations.filter(
    (invitation) => invitation.status === 'PENDING' && !invitation.projectArchived,
  ).length;
}
