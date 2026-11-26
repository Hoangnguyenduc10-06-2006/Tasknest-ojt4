import type { MyProjectItem } from '../../projects';
import type { Task, TaskPriority } from '../../tasks';

const priorityRank: Record<TaskPriority, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export function selectMyPriorityTasks(
  tasks: readonly Task[],
  projects: readonly MyProjectItem[],
  userId: string,
) {
  const activeProjects = new Set(projects.filter(project => project.status === 'ACTIVE').map(project => project.id));

  return tasks.filter(task =>
    activeProjects.has(task.projectId) &&
    task.assignee.id === userId &&
    (task.status === 'TODO' || task.status === 'IN_PROGRESS' || task.status === 'BLOCKED'),
  ).sort((a, b) =>
    priorityRank[b.priority] - priorityRank[a.priority] ||
    (b.decision?.score ?? 0) - (a.decision?.score ?? 0) ||
    (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31') ||
    a.id.localeCompare(b.id, 'vi', { numeric: true }),
  );
}
