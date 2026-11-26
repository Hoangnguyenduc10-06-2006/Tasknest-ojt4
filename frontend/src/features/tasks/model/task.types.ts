export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'DONE'
  | 'BLOCKED'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskAssignee {
  id: string;
  name: string;
  avatarText?: string;
  role: 'Owner' | 'Manager' | 'Member' | 'Customer';
  isCurrentUser?: boolean;
}

export interface TaskDecision {
  score: number;
  level: 'none' | 'low' | 'medium' | 'high';
  reasons: string[];
  nextStep: string;
}

export interface Task {
  decision?: TaskDecision;
  id: string;
  code: string;
  projectId: string;
  title: string;
  description: string;
  assignee: TaskAssignee;
  priority: TaskPriority;
  status: TaskStatus;
  startDate?: string;
  deadline?: string;
  estimatedHours: number;
  spentHours?: number;
  isBlocked?: boolean;
  blockedReason?: string;
  version?: number;
  createdAt: string;
  completedAt?: string;
  acceptedSubmittedAt?: string;
  acceptedDeadlineOn?: string;
  riskBadge?: string;
  riskType?: 'warning' | 'danger' | 'info';
  deadlineStatus?: string;
  commentsCount?: number;
}

export interface MyTaskItem {
  isBlocked?: boolean;
  projectId?: string;
  createdAt?: string;
  id: string;
  code: string;
  title: string;
  projectName: string;
  projectCode: string;
  projectTone: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string;
}

export interface CreateTaskInput {
  title: string;
  description: string;
  assigneeId: string;
  priority: TaskPriority;
  startDate?: string;
  deadline?: string;
  estimatedHours: number;
}

export interface TaskFormErrors {
  title?: string;
  assigneeId?: string;
  priority?: string;
  deadline?: string;
  estimatedHours?: string;
  startDate?: string;
}
