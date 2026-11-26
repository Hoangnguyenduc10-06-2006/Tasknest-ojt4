import type { ProjectApiResponse } from '../api/project.api';
import type { MyProjectItem, ProjectRole } from './project.types';
import { formatProjectDateRange, generateProjectCode } from './project.validation';

export function mapProject(project: ProjectApiResponse): MyProjectItem {
  const roles: Record<string, ProjectRole> = { CUSTOMER: 'Customer', Customer: 'Customer', OWNER: 'Owner', MANAGER: 'Manager', MEMBER: 'Member', Owner: 'Owner', Manager: 'Manager', Member: 'Member' };
  return {
    id: String(project.id), name: project.name, description: project.description,
    code: generateProjectCode(project.name), role: roles[project.role] ?? 'Member',
    status: project.status, developmentState: project.developmentState, startDate: project.startsOn, endDate: project.endsOn,
    dateRange: formatProjectDateRange(project.startsOn, project.endsOn),
    progress: 0, version: project.version,
    hasAvatar: project.hasAvatar, createdAtMs: Date.parse(project.createdAt),
    updatedAtMs: Date.parse(project.updatedAt),
    updatedAt: new Date(project.updatedAt).toLocaleString('vi-VN'),
    iconBgClass: 'bg-tint text-accent border-line',
  };
}
