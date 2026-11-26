import type { ProjectRole } from './project.types';
export type { ProjectRole } from './project.types';
export type ProjectMemberTab = 'members' | 'invitations' | 'requests';
export interface ProjectMemberItem {
  id: string;
  userId: string;
  name: string;
  role: ProjectRole;
  status: string;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
  expiresAt: string | null;
  reason: string | null;
}
export interface ProjectMembersSnapshot {
  items: ProjectMemberItem[];
  total: number;
  page: number;
  size: number;
  role: 'OWNER' | 'MANAGER' | 'MEMBER' | 'CUSTOMER';
  archived: boolean;
}
export interface ProjectShareLink {
  code: string;
  createdBy: string;
  creatorName: string | null;
  createdAt: string;
}
