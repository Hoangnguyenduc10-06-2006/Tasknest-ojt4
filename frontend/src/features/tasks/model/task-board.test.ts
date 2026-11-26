import { describe, expect, it } from 'vitest';
import { INITIAL_PROJECT_TASKS } from '../mocks/tasks.mock';
import {
  availableTransitions,
  filterBoardTasks,
  needsTransitionNote,
  type BoardFilters,
} from './task-board';
import { businessToday } from '../../../shared/utils/business-date';
import type { TaskStatus } from './task.types';
const filters: BoardFilters = {
  search: '',
  assignee: 'ALL',
  priority: 'ALL',
  status: 'ALL',
  todayOnly: false,
};
const task = {
  ...INITIAL_PROJECT_TASKS[0],
  status: 'TODO' as TaskStatus,
  assignee: { ...INITIAL_PROJECT_TASKS[0].assignee, id: 'assigned' },
  deadline: '2026-10-29',
};
describe('Kanban filters and workflow', () => {
  it('compares ISO deadlines using the Vietnam business date, including across UTC midnight', () => {
    const today = businessToday(Date.parse('2026-10-28T18:00:00Z'));
    expect(today).toBe('2026-10-29');
    expect(
      filterBoardTasks(
        [task, { ...task, id: 'tomorrow', deadline: '2026-10-30' }],
        { ...filters, todayOnly: true },
        today,
      ),
    ).toEqual([task]);
  });
  it('combines trimmed search, priority, assignee and blocked flag without inventing a blocked status', () => {
    const blocked = {
      ...task,
      title: 'Tích hợp API',
      priority: 'HIGH' as const,
      isBlocked: true,
    };
    const input = {
      ...filters,
      search: '  tích hợp  ',
      priority: 'HIGH' as const,
      assignee: 'assigned',
      status: 'BLOCKED' as const,
    };
    expect(filterBoardTasks([task, blocked], input, '2026-10-29')).toEqual([
      blocked,
    ]);
    expect(
      filterBoardTasks(
        [blocked],
        { ...input, assignee: 'other' },
        '2026-10-29',
      ),
    ).toEqual([]);
  });
  it('includes cancelled tasks in list filters', () => {
    const cancelled = { ...task, status: 'CANCELLED' as const };
    expect(
      filterBoardTasks(
        [task, cancelled],
        { ...filters, status: 'CANCELLED' },
        '2026-10-29',
      ),
    ).toEqual([cancelled]);
  });
  it('prevents members approving, reopening, cancelling or changing another assignee task', () => {
    expect(availableTransitions(task, 'other', 'Member', false)).toEqual([]);
    expect(availableTransitions(task, 'assigned', 'Member', false)).toEqual([
      'IN_PROGRESS',
    ]);
    expect(
      availableTransitions(
        { ...task, status: 'IN_PROGRESS' },
        'assigned',
        'Member',
        false,
      ),
    ).toEqual(['REVIEW']);
    for (const status of ['REVIEW', 'DONE', 'CANCELLED'] as const)
      expect(
        availableTransitions({ ...task, status }, 'assigned', 'Member', false),
      ).toEqual([]);
  });
  it('allows managers to cancel and review while keeping archived projects read-only', () => {
    expect(availableTransitions(task, 'manager', 'Manager', false)).toEqual(['CANCELLED']);
    for (const role of ['Owner', 'Manager', 'Member']) {
      expect(availableTransitions(task, 'other', role, false)).not.toContain('IN_PROGRESS');
      expect(availableTransitions(task, 'assigned', role, false)).toContain('IN_PROGRESS');
    }
    expect(
      availableTransitions(
        { ...task, status: 'REVIEW' },
        'owner',
        'Owner',
        false,
      ),
    ).toEqual(['DONE', 'IN_PROGRESS', 'CANCELLED']);
    expect(availableTransitions(task, 'owner', 'Owner', true)).toEqual([]);
    expect(availableTransitions(task, undefined, 'Owner', false)).toEqual([]);
  });
  it('only allows the assigned user to submit results, including owners and managers', () => {
    const doing = { ...task, status: 'IN_PROGRESS' as const };
    for (const role of ['Owner', 'Manager', 'Member']) {
      expect(availableTransitions(doing, 'other', role, false)).not.toContain('REVIEW');
      expect(availableTransitions(doing, 'assigned', role, false)).toContain('REVIEW');
    }
  });
  it('requires result notes and reasons for rework, reopen and cancellation', () => {
    expect(needsTransitionNote('TODO', 'IN_PROGRESS')).toBe(false);
    expect(needsTransitionNote('IN_PROGRESS', 'REVIEW')).toBe(true);
    expect(needsTransitionNote('REVIEW', 'IN_PROGRESS')).toBe(true);
    expect(needsTransitionNote('DONE', 'IN_PROGRESS')).toBe(true);
    expect(needsTransitionNote('TODO', 'CANCELLED')).toBe(true);
  });
  it('filters DUE_SOON tasks due today or tomorrow while skipping DONE, CANCELLED, REVIEW and far-future tasks', () => {
    const dueToday = { ...task, id: 'due-today', status: 'TODO' as const, deadline: '2026-10-29' };
    const dueTomorrow = { ...task, id: 'due-tomorrow', status: 'IN_PROGRESS' as const, deadline: '2026-10-30' };
    const dueInTwoDays = { ...task, id: 'due-later', status: 'TODO' as const, deadline: '2026-10-31' };
    const overdueTask = { ...task, id: 'overdue', status: 'TODO' as const, deadline: '2026-10-28' };
    const doneTomorrow = { ...task, id: 'done', status: 'DONE' as const, deadline: '2026-10-30' };
    const cancelledTomorrow = { ...task, id: 'cancelled', status: 'CANCELLED' as const, deadline: '2026-10-30' };
    const reviewTomorrow = { ...task, id: 'review', status: 'REVIEW' as const, deadline: '2026-10-30' };
    expect(
      filterBoardTasks(
        [dueToday, dueTomorrow, dueInTwoDays, overdueTask, doneTomorrow, cancelledTomorrow, reviewTomorrow],
        { ...filters, alert: 'DUE_SOON' },
        '2026-10-29',
      ).map((item) => item.id),
    ).toEqual(['due-today', 'due-tomorrow']);
  });
});
