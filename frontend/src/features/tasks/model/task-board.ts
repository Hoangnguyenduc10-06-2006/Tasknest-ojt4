import { addBusinessDays } from '../../../shared/utils/business-date';
import type { Task, TaskPriority, TaskStatus } from './task.types';

export const taskColumns = [
  { status: 'TODO', label: 'Chưa bắt đầu' },
  { status: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { status: 'REVIEW', label: 'Chờ duyệt' },
  { status: 'DONE', label: 'Hoàn thành' },
] as const;
export const statusLabels: Record<TaskStatus, string> = {
  TODO: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  REVIEW: 'Chờ duyệt',
  DONE: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  BLOCKED: 'Đang bị chặn',
};
export type BoardFilters = {
  search: string;
  assignee: string;
  status: TaskStatus | 'ALL';
  priority: TaskPriority | 'ALL';
  todayOnly: boolean;
  fromDate?: string;
  toDate?: string;
  alert?: string;
  sort?: string;
};
export function filterBoardTasks(
  tasks: Task[],
  filters: BoardFilters,
  today: string,
) {
  const search = filters.search.trim().toLocaleLowerCase('vi');
  const tomorrow = addBusinessDays(today, 1);
  return tasks.filter(
    (task) =>
      (!search ||
        `${task.code} ${task.title}`
          .toLocaleLowerCase('vi')
          .includes(search)) &&
      (filters.assignee === 'ALL' || task.assignee.id === filters.assignee) &&
      (filters.status === 'ALL' ||
        (filters.status === 'BLOCKED'
          ? task.isBlocked
          : task.status === filters.status)) &&
      (filters.priority === 'ALL' || task.priority === filters.priority) &&
      (!filters.todayOnly || task.deadline === today) &&
      (!filters.fromDate || !!task.deadline && task.deadline >= filters.fromDate) &&
      (!filters.toDate || !!task.deadline && task.deadline <= filters.toDate) &&
      (!filters.alert || filters.alert === 'ALL' ||
        filters.alert === 'DUE_SOON' && ['TODO','IN_PROGRESS'].includes(task.status) && !!task.deadline && task.deadline >= today && task.deadline <= tomorrow ||
        filters.alert === 'OVERDUE' && ['TODO','IN_PROGRESS'].includes(task.status) && !!task.deadline && task.deadline < today ||
        filters.alert === 'REVIEW_OVERDUE' && task.status === 'REVIEW' && !!task.deadline && task.deadline < today ||
        filters.alert === 'OVERRUN' && !['DONE','CANCELLED'].includes(task.status) && task.spentHours !== undefined && task.spentHours > task.estimatedHours ||
        filters.alert === 'RISK' && !['DONE','CANCELLED'].includes(task.status) && task.spentHours !== undefined && task.spentHours >= task.estimatedHours*.8 && task.spentHours <= task.estimatedHours),
  ).sort((a,b)=> {
    if(filters.sort==='NAME')return a.title.localeCompare(b.title,'vi');
    if(filters.sort==='CREATED')return Date.parse(b.createdAt)-Date.parse(a.createdAt);
    if(filters.sort==='PRIORITY'){const rank:Record<string,number>={HIGH:3,MEDIUM:2,LOW:1};return (rank[b.priority]??0)-(rank[a.priority]??0);}
    if(filters.sort==='DEADLINE')return (a.deadline??'9999').localeCompare(b.deadline??'9999');
    return 0;
  });
}
export function availableTransitions(
  task: Task,
  userId: string | undefined,
  role: string,
  archived: boolean,
): TaskStatus[] {
  if (role === 'Customer') return [];
  if (archived || !userId) return [];
  const manager = role === 'Owner' || role === 'Manager';
  const assignee = task.assignee.id === userId;
  if (!manager && !assignee) return [];
  switch (task.status) {
    case 'TODO':
      return assignee ? (manager ? ['IN_PROGRESS', 'CANCELLED'] : ['IN_PROGRESS']) : manager ? ['CANCELLED'] : [];
    case 'IN_PROGRESS':
      return assignee ? (manager ? ['REVIEW', 'CANCELLED'] : ['REVIEW']) : manager ? ['CANCELLED'] : [];
    case 'REVIEW':
      return manager ? ['DONE', 'IN_PROGRESS', 'CANCELLED'] : [];
    case 'DONE':
      return manager ? ['IN_PROGRESS'] : [];
    default:
      return [];
  }
}
export function needsTransitionNote(from: TaskStatus, to: TaskStatus) {
  return (
    to === 'REVIEW' ||
    to === 'CANCELLED' ||
    (to === 'IN_PROGRESS' && from !== 'TODO')
  );
}
