import { authenticatedAccessToken } from '../../auth';
import { requestJson } from '../../../shared/api/client';
import type {
  CreateProjectInput,
  ProjectRole,
  ProjectStatus,
} from '../model/project.types';
import { normalizeProjectName } from '../model/project.validation';

export interface ProjectApiResponse {
  id: number;
  name: string;
  description: string;
  ownerUserId: string;
  managerUserId: string | null;
  status: ProjectStatus;
  developmentState?: 'ACTIVE' | 'PENDING_KICKOFF' | 'COMPLETED';
  role: 'OWNER' | 'MANAGER' | 'MEMBER' | 'CUSTOMER' | ProjectRole;
  startsOn: string;
  endsOn: string;
  hasAvatar: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ProjectListQueryParams {
  q?: string;
  status?: ProjectStatus;
  role?: ProjectRole;
  page?: number;
  size?: number;
  sort?: 'UPDATED_DESC' | 'NAME_ASC' | 'NAME_DESC';
}

export interface UpdateProjectRequestPayload {
  name: string;
  description: string;
  startsOn: string;
  endsOn: string;
  version: number;
}

export async function updateProject(
  userId: string,
  projectId: string | number,
  payload: UpdateProjectRequestPayload,
): Promise<ProjectApiResponse> {
  requireProjectId(projectId);
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: ProjectApiResponse }>(
    `/api/work/projects/${encodeURIComponent(String(projectId))}`,
    {
      method: 'PUT',
      accessToken,
      body: {
        name: normalizeProjectName(payload.name),
        description: payload.description.trim(),
        startsOn: payload.startsOn,
        endsOn: payload.endsOn,
        version: payload.version,
      },
    },
  );
  return response.data;
}

export async function archiveProject(
  userId: string,
  projectId: string | number,
  version: number,
): Promise<ProjectApiResponse> {
  requireProjectId(projectId);
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: ProjectApiResponse }>(
    `/api/work/projects/${encodeURIComponent(String(projectId))}/archive`,
    {
      method: 'POST',
      accessToken,
      body: { version },
    },
  );
  return response.data;
}

export async function reopenProject(
  userId: string,
  projectId: string | number,
  version: number,
): Promise<ProjectApiResponse> {
  requireProjectId(projectId);
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: ProjectApiResponse }>(
    `/api/work/projects/${encodeURIComponent(String(projectId))}/reopen`,
    {
      method: 'POST',
      accessToken,
      body: { version },
    },
  );
  return response.data;
}


export function requireProjectId(id: string | number) {
  if (!/^[1-9][0-9]*$/.test(String(id))) {
    throw new Error('ID dự án không hợp lệ. Vui lòng tải lại danh sách dự án.');
  }
}

/** Complete membership-scoped catalog for navigation, dashboard and client filtering. */
export async function listProjects(
  userId: string,
): Promise<ProjectApiResponse[]> {
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: ProjectApiResponse[] }>(
    '/api/work/projects/index',
    { accessToken },
  );
  return response.data;
}

/** Server-paginated query; never replaces the complete shared catalog. */
export async function listProjectPage(
  userId: string,
  params: ProjectListQueryParams = {},
): Promise<ProjectPageResponse<ProjectApiResponse>> {
  const accessToken = await authenticatedAccessToken(userId);
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.status) query.set('status', params.status);
  if (params.role) query.set('role', params.role.toUpperCase());
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.size !== undefined) query.set('size', String(params.size));
  if (params.sort) query.set('sort', params.sort);
  const response = await requestJson<{
    data: ProjectPageResponse<ProjectApiResponse>;
  }>(`/api/work/projects${query.size ? '?' + query.toString() : ''}`, {
    accessToken,
  });
  return response.data;
}

export async function createProject(
  userId: string,
  input: CreateProjectInput,
): Promise<ProjectApiResponse> {
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: ProjectApiResponse }>(
    '/api/work/projects',
    {
      method: 'POST',
      accessToken,
      body: {
        name: normalizeProjectName(input.name),
        description: input.description.trim(),
        startsOn: input.startDate,
        endsOn: input.endDate,
      },
    },
  );
  return response.data;
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<ProjectApiResponse> {
  requireProjectId(projectId);
  const accessToken = await authenticatedAccessToken(userId);
  const response = await requestJson<{ data: ProjectApiResponse }>(
    `/api/work/projects/${projectId}`,
    { accessToken },
  );
  return response.data;
}
