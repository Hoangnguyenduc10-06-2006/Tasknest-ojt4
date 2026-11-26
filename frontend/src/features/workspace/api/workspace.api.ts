import { authenticatedAccessToken } from '../../auth';
import { requestJson } from '../../../shared/api/client';
import type { Task, TaskAssignee } from '../../tasks';
import type { DirectInvitation, JoinRequest } from '../../projects/model/invitation.types';
import { generateProjectCode } from '../../projects/model/project.validation';

export type Member = TaskAssignee & { projectId: string };
export type TimeEntry = {
  id: number;
  projectId: number;
  taskId: number;
  taskTitle: string;
  projectName: string;
  startedAt: string;
  endedAt: string | null;
  source: string;
  version: number;
};
type RawTask = {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  assigneeId: string;
  priority: Task['priority'];
  status: string;
  startsOn: string;
  deadlineOn: string;
  decision?: import('../../tasks/model/task.types').TaskDecision;
  estimatedSeconds: number;
  blocked: boolean;
  blockedReason: string | null;
  spentSeconds: number | null;
  version: number;
  createdAt: string;
  completedAt?: string|null;
  acceptedSubmittedAt?: string|null;
  acceptedDeadlineOn?: string|null;
};
type RawMember = {
  projectId: number;
  id: string;
  name: string;
  role: TaskAssignee['role'];
};
type RawInvitation = {
  id: number;
  projectId: number;
  projectName: string;
  inviterName: string;
  inviterRole: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  projectArchived?: boolean;
};
type RawRequest = {
  id: number;
  projectId: number;
  projectName: string;
  reason: string | null;
  status: string;
  createdAt: string;
  projectArchived?: boolean;
};
export type CustomerProgress = { projectId: number; total: number; done: number };
export type RawWorkspace = {
  customerProgress?: CustomerProgress[];
  tasks: RawTask[];
  members: RawMember[];
  timeEntries: TimeEntry[];
  invitations: RawInvitation[];
  joinRequests: RawRequest[];
};
export type WorkspaceData = {
  customerProgress?: CustomerProgress[];
  tasks: Task[];
  members: Member[];
  timeEntries: TimeEntry[];
  invitations: DirectInvitation[];
  joinRequests: JoinRequest[];
};
const dateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

export function mapWorkspace(raw: RawWorkspace, userId: string): WorkspaceData {
  const members = raw.members.map((member) => ({
    ...member,
    projectId: String(member.projectId),
    isCurrentUser: member.id === userId,
    avatarText: member.name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(-2)
      .join('')
      .toUpperCase(),
  }));
  return {
    members,
    customerProgress: raw.customerProgress ?? [],
    timeEntries: raw.timeEntries,
    tasks: raw.tasks.map((task) => ({
      id: String(task.id),
      code: `TSK-${task.id}`,
      projectId: String(task.projectId),
      title: task.title,
      description: task.description ?? '',
      assignee: members.find(
        (member) =>
          member.id === task.assigneeId &&
          member.projectId === String(task.projectId),
      ) ?? {
        id: task.assigneeId,
        name: task.assigneeId,
        role: 'Member',
        isCurrentUser: task.assigneeId === userId,
      },
      priority: task.priority,
      status:
        task.status === 'IN_REVIEW'
          ? 'REVIEW'
          : (task.status as Task['status']),
      startDate: task.startsOn,
      deadline: task.deadlineOn,
      decision: task.decision,
      estimatedHours: task.estimatedSeconds / 3600,
      spentHours:
        task.spentSeconds === null ? undefined : task.spentSeconds / 3600,
      isBlocked: task.blocked,
      blockedReason: task.blockedReason ?? undefined,
      version: task.version,
      createdAt: task.createdAt,
      completedAt: task.completedAt??undefined,
      acceptedSubmittedAt: task.acceptedSubmittedAt??undefined,
      acceptedDeadlineOn: task.acceptedDeadlineOn??undefined,
    })),
    invitations: raw.invitations.map((item) => ({
      id: String(item.id),
      projectId: String(item.projectId),
      projectName: item.projectName,
      projectCode: generateProjectCode(item.projectName),
      invitedAt: dateTime(item.createdAt),
      inviterName: item.inviterName,
      inviterRole: item.inviterRole,
      role: 'Member',
      message: `Có hiệu lực đến ${dateTime(item.expiresAt)}`,
      status: (item.status === 'REJECTED'
        ? 'DECLINED'
        : item.status) as DirectInvitation['status'],
      projectArchived: Boolean(item.projectArchived),
    })),
    joinRequests: raw.joinRequests.map((item) => ({
      id: String(item.id),
      projectId: String(item.projectId),
      projectName: item.projectName,
      projectCode: generateProjectCode(item.projectName),
      sentAt: dateTime(item.createdAt),
      message: item.reason ?? '',
      status: item.status as JoinRequest['status'],
      projectArchived: Boolean(item.projectArchived),
    })),
  };
}
export async function readWorkspace(userId: string) {
  const accessToken = await authenticatedAccessToken(userId);
  const result = await requestJson<{ data: RawWorkspace }>(
    '/api/work/projects/workspace',
    { accessToken },
  );
  return mapWorkspace(result.data, userId);
}
export async function workAction(
  userId: string,
  path: string,
  body?: unknown,
  method: 'POST' | 'PUT' = 'PUT',
) {
  const accessToken = await authenticatedAccessToken(userId);
  return requestJson<{ data: number }>(`/api/work/projects/${path}`, {
    accessToken,
    method,
    body,
  });
}
