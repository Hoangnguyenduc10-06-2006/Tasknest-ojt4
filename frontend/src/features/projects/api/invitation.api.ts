import { authenticatedAccessToken } from '../../auth';
import { requestJson } from '../../../shared/api/client';
import { workAction } from '../../workspace';
export type JoinLinkPreview = {
  projectId: number;
  projectName: string;
  member: boolean;
  creatorName: string;
};
export function respondInvitation(
  userId: string,
  projectId: string,
  id: string,
  action: 'accept' | 'decline',
) {
  return workAction(userId, `${projectId}/invitations/${id}/${action}`);
}
export function cancelJoinRequest(
  userId: string,
  projectId: string,
  id: string,
) {
  return workAction(userId, `${projectId}/join-requests/${id}/cancel`);
}
export async function previewJoinLink(userId: string, code: string) {
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: JoinLinkPreview }>(
    `/api/work/projects/workspace/join-links/${code}`,
    { accessToken },
  );
  return response.data;
}
export function submitJoinRequest(
  userId: string,
  code: string,
  reason: string,
) {
  return workAction(
    userId,
    'workspace/join-requests',
    { code, reason: reason.trim() },
    'POST',
  );
}
