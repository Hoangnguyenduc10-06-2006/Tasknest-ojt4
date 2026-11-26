import { describe, expect, it } from 'vitest';
import type { Task, TaskPriority, TaskStatus } from './task.types';

function groupTasksByDeadline(tasks: Task[]) {
  const map = new Map<string, Task[]>();
  const unscheduled: Task[] = [];

  for (const task of tasks) {
    if (task.status === 'CANCELLED') continue;
    if (task.deadline && /^\d{4}-\d{2}-\d{2}$/.test(task.deadline)) {
      const list = map.get(task.deadline) ?? [];
      list.push(task);
      map.set(task.deadline, list);
    } else {
      unscheduled.push(task);
    }
  }

  return { tasksByDate: map, unscheduledTasks: unscheduled };
}

describe('Task Calendar logic', () => {
  const sampleTask = (id: string, deadline?: string, status: TaskStatus = 'TODO'): Task => ({
    id,
    code: `TSK-${id}`,
    projectId: 'p1',
    title: `Task ${id}`,
    description: '',
    assignee: { id: 'u1', name: 'Dev', role: 'Member' },
    priority: 'MEDIUM' as TaskPriority,
    status,
    deadline,
    estimatedHours: 2,
    createdAt: '2026-11-01',
  });

  it('groups tasks by deadline correctly', () => {
    const tasks = [
      sampleTask('1', '2026-11-10'),
      sampleTask('2', '2026-11-10'),
      sampleTask('3', '2026-11-15'),
      sampleTask('4', undefined),
      sampleTask('5', 'invalid-date'),
    ];

    const { tasksByDate, unscheduledTasks } = groupTasksByDeadline(tasks);

    expect(tasksByDate.get('2026-11-10')?.length).toBe(2);
    expect(tasksByDate.get('2026-11-15')?.length).toBe(1);
    expect(tasksByDate.get('2026-11-20')).toBeUndefined();
    expect(unscheduledTasks.length).toBe(2);
    expect(unscheduledTasks.map((t) => t.id)).toEqual(['4', '5']);
  });

  it('excludes cancelled tasks from calendar grouping', () => {
    const tasks = [
      sampleTask('1', '2026-11-10', 'CANCELLED'),
      sampleTask('2', '2026-11-10', 'IN_PROGRESS'),
    ];

    const { tasksByDate } = groupTasksByDeadline(tasks);
    expect(tasksByDate.get('2026-11-10')?.length).toBe(1);
    expect(tasksByDate.get('2026-11-10')?.[0].id).toBe('2');
  });
});

