import { selectTasksNeedingReview } from '../../tasks/model/task.selectors';
import { businessToday } from '../../../shared/utils/business-date';
import type { MyProjectItem } from '../../projects';
import type { Task } from '../../tasks';
import type { Member } from '../../workspace';
import type { DashboardData, AttentionReason } from './dashboard.types';

export function buildDashboard(
  userName: string,
  tasks: Task[],
  projects: MyProjectItem[],
  members: Member[],
  now = Date.now(),
): DashboardData {
  const today = businessToday(now);
  const soon = businessToday(now + 3 * 86400000);
  const personal = tasks.filter((task) => task.assignee.isCurrentUser);
  const open = (task: Task) =>
    task.status === 'TODO' || task.status === 'IN_PROGRESS';
  const activeIds = new Set(
    projects
      .filter((project) => project.status === 'ACTIVE')
      .map((project) => project.id),
  );
  const active = personal.filter((task) => activeIds.has(task.projectId));
  const reviewableIds = new Set(projects.filter(project => project.status === 'ACTIVE' && ['owner', 'manager'].includes(project.role.toLowerCase())).map(project => project.id));
  const reviews = selectTasksNeedingReview(tasks, projects);
  return {
    awaitingTasks: active.filter(task => task.status === 'REVIEW').map(task => ({ id: task.id, title: task.title, projectName: projects.find(project => project.id === task.projectId)?.name ?? '', assigneeName: task.assignee.name, canReview: false })),
    reviewTasks: reviews.map(task => ({ id: task.id, title: task.title, projectName: projects.find(project => project.id === task.projectId)?.name ?? '', assigneeName: task.assignee.name, canReview: reviewableIds.has(task.projectId) })),
    userName,
    stats: [
      {
        key: 'in_progress',
        count: active.filter((task) => task.status === 'IN_PROGRESS').length,
      },
      {
        key: 'due_soon',
        count: active.filter(
          (task) =>
            open(task) &&
            task.deadline &&
            task.deadline >= today &&
            task.deadline <= soon,
        ).length,
      },
      {
        key: 'overdue',
        count: active.filter(
          (task) => open(task) && task.deadline && task.deadline < today,
        ).length,
      },
      {
        key: 'awaiting_review',
        count: active.filter(task => task.status === 'REVIEW').length,
      },
      {
        key: 'needs_review',
        count: reviews.length,
      },
    ],
    attentionTasks: active
      .filter((task) => task.status !== 'DONE' && task.status !== 'CANCELLED')
      .flatMap((task) => {
        const reasons: AttentionReason[] = [];
        if (open(task) && task.deadline && task.deadline < today)
          reasons.push('overdue');
        if (task.isBlocked) reasons.push('blocked');
        if (task.spentHours !== undefined && task.estimatedHours > 0) {
          const ratio = task.spentHours / task.estimatedHours;
          if (ratio > 1) reasons.push('over_estimate');
          else if (ratio >= 0.8) reasons.push('estimate_risk');
        }
        if (!reasons.length && !task.decision?.reasons.length) return [];
        return [
          {
            decision: task.decision,
            id: task.id,
            title: task.title,
            projectName:
              projects.find((project) => project.id === task.projectId)?.name ??
              '',
            dueLabel: task.deadline ?? 'Chưa đặt hạn',
            priority:
              task.priority === 'LOW'
                ? ('low' as const)
                : task.priority === 'MEDIUM'
                  ? ('medium' as const)
                  : ('high' as const),
            reasons,
            assignee: {
              name: task.assignee.name,
              initials: task.assignee.avatarText ?? '',
            },
          },
        ];
      }).sort((a, b) => (b.decision?.score ?? 0) - (a.decision?.score ?? 0)
        || a.dueLabel.localeCompare(b.dueLabel) || a.id.localeCompare(b.id)),
    activeProjects: projects
      .filter((project) => project.status === 'ACTIVE')
      .map((project) => {
        const eligible = tasks.filter(
          (task) =>
            task.projectId === project.id && task.status !== 'CANCELLED',
        );
        return {
          id: project.id,
          name: project.name,
          initials: project.code,
          memberCount: members.filter(
            (member) => member.projectId === project.id,
          ).length,
          role: project.role.toLowerCase() as 'owner' | 'manager' | 'member',
          completedTasks: eligible.filter((task) => task.status === 'DONE')
            .length,
          eligibleTasks: eligible.length,
          tone: 'accent' as const,
        };
      }),
  };
}
