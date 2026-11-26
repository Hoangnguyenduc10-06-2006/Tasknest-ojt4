export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';

export type ProjectRole = 'Owner' | 'Manager' | 'Member' | 'Customer';

export interface MyProjectItem {
  id: string;
  code: string;
  name: string;
  description: string;
  role: ProjectRole;
  dateRange: string;
  startDate?: string;
  endDate?: string;
  progress: number;
  taskCount?: number;
  status: ProjectStatus;
  developmentState?: 'ACTIVE' | 'PENDING_KICKOFF' | 'COMPLETED';
  updatedAt: string;
  updatedAtMs: number;
  createdAtMs?: number;
  hasAvatar?: boolean;
  version?: number;
  imageUrl?: string;
  iconBgClass: string;
}

export interface CreateProjectInput {
  imageUrl?: string;
  name: string;
  description: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateProjectInput {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  version: number;
}

export interface ProjectFormData {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
}

export interface ProjectValidationResult {
  isValid: boolean;
  errors: Partial<Record<keyof ProjectFormData, string>>;
}
