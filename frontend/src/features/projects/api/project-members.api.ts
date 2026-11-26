import { authenticatedAccessToken } from '../../auth';
import { requestJson } from '../../../shared/api/client';
import { requireProjectId } from './project.api';
import type {
  ProjectMembersSnapshot,
  ProjectMemberTab,
  ProjectShareLink,
} from '../model/project-member.types';
async function memberRequest<T>(
  userId: string,
  projectId: string,
  suffix: string,
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  body?: unknown,
): Promise<T> {
  requireProjectId(projectId);
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: T }>(
    `/api/work/projects/${projectId}/${suffix}`,
    { accessToken, method, body },
  );
  return response.data;
}
export const listProjectMembers = (
  user: string,
  project: string,
  tab: ProjectMemberTab,
  page: number,
  size: number,
) =>
  memberRequest<ProjectMembersSnapshot>(
    user,
    project,
    `members?${new URLSearchParams({ tab, page: String(page), size: String(size) })}`,
  );
export const inviteProjectMember = (
  user: string,
  project: string,
  email: string,
) =>
  memberRequest<number>(user, project, 'invitations', 'POST', {
    email: email.trim().toLowerCase(),
  });
export const cancelProjectInvitation = (
  user: string,
  project: string,
  id: string,
) =>
  memberRequest<void>(
    user,
    project,
    `invitations/${encodeURIComponent(id)}/cancel`,
    'PUT',
  );
export const decideProjectRequest = (
  user: string,
  project: string,
  id: string,
  accept: boolean,
) =>
  memberRequest<void>(
    user,
    project,
    `join-requests/${encodeURIComponent(id)}/decision`,
    'PUT',
    { accept },
  );
export const setProjectMemberRole = (
  user: string,
  project: string,
  id: string,
  role: 'Manager' | 'Member',
) =>
  memberRequest<void>(
    user,
    project,
    `members/${encodeURIComponent(id)}/role`,
    'PUT',
    { role },
  );
export const removeProjectMember = (
  user: string,
  project: string,
  id: string,
) =>
  memberRequest<void>(
    user,
    project,
    `members/${encodeURIComponent(id)}/remove`,
    'PUT',
  );
export const getProjectShareLink = (user: string, project: string) =>
  memberRequest<ProjectShareLink | null>(user, project, 'invitation-link');
export const changeProjectShareLink = (
  user: string,
  project: string,
  action: 'CREATE' | 'ROTATE' | 'DISABLE',
) =>
  memberRequest<ProjectShareLink | null>(
    user,
    project,
    'invitation-link',
    'PUT',
    { action },
  );
export const projectJoinUrl = (origin: string, code: string) =>
  `${origin}/join/${encodeURIComponent(code)}`;
