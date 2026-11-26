import type { Task } from './task.types';
import type { MyProjectItem } from '../../projects';

export function selectTasksNeedingReview(tasks: Task[], projects: MyProjectItem[]) {
  const managed = new Set(projects.filter(project => project.status === 'ACTIVE' && ['owner', 'manager'].includes(project.role.toLowerCase())).map(project => project.id));
  return tasks.filter(task => task.status === 'REVIEW' && !task.assignee.isCurrentUser && managed.has(task.projectId));
}

export function selectProjectTasks(tasks: Task[], projectId: string) {
  return tasks.filter((task) => task.projectId === projectId);
}
export function summarizeTasks(tasks: Task[]) {
  tasks = tasks.filter((task) => task.status !== 'CANCELLED');
  const completed = tasks.filter((task) => task.status === 'DONE').length;
  return {
    completed,
    progress: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    estimated: tasks.reduce((sum, task) => sum + task.estimatedHours, 0),
    logged: tasks.reduce((sum, task) => sum + (task.spentHours ?? 0), 0),
  };
}
