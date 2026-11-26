export type TaskStatKey = 'in_progress' | 'due_soon' | 'overdue' | 'awaiting_review' | 'needs_review';

export type TaskStat = {
  key: TaskStatKey;
  count: number;
};

export type AttentionReason = 'estimate_risk' | 'over_estimate' | 'blocked' | 'overdue';
export type TaskPriority = 'high' | 'medium' | 'low';

export type AttentionTask = {
  decision?: import('../../tasks/model/task.types').TaskDecision;
  id: string;
  title: string;
  projectName: string;
  dueLabel: string;
  priority: TaskPriority;
  reasons: AttentionReason[];
  assignee: { name: string; initials: string };
};

export type ProjectRole = 'owner' | 'manager' | 'member';

export type ActiveProject = {
  id: string;
  name: string;
  initials: string;
  memberCount: number;
  role: ProjectRole;
  completedTasks: number;
  /** All tasks except CANCELLED; denominator of current completion. */
  eligibleTasks: number;
  tone: 'accent' | 'danger' | 'success' | 'warning' | 'review';
};

export type ReviewTask = { id: string; title: string; projectName: string; assigneeName: string; canReview: boolean };

export type DashboardData = {
  awaitingTasks?: ReviewTask[];
  reviewTasks?: ReviewTask[];
  userName: string;
  stats: TaskStat[];
  attentionTasks: AttentionTask[];
  activeProjects: ActiveProject[];
};
