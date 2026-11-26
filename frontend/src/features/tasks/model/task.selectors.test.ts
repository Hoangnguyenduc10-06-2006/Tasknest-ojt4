import { describe, expect, it } from 'vitest';
import { INITIAL_PROJECT_TASKS } from '../mocks/tasks.mock';
import { selectProjectTasks, summarizeTasks } from './task.selectors';

describe('project task isolation and overview', () => {
  it('never includes another project in the selected tasks or summary', () => {
    const tasks = [
      {
        ...INITIAL_PROJECT_TASKS[0],
        projectId: 'a',
        status: 'DONE' as const,
        estimatedHours: 2,
        spentHours: 1,
      },
      { ...INITIAL_PROJECT_TASKS[1], projectId: 'b', estimatedHours: 100 },
    ];
    const selected = selectProjectTasks(tasks, 'a');
    expect(selected).toHaveLength(1);
    expect(summarizeTasks(selected)).toEqual({
      completed: 1,
      progress: 100,
      estimated: 2,
      logged: 1,
    });
    expect(selectProjectTasks(tasks, 'missing')).toEqual([]);
  });
  it('handles a new project without NaN percentages', () => {
    expect(summarizeTasks([])).toEqual({
      completed: 0,
      progress: 0,
      estimated: 0,
      logged: 0,
    });
  });
  it('uses all tasks in the denominator and treats missing logged hours as zero', () => {
    const tasks = INITIAL_PROJECT_TASKS.slice(0, 3).map((task, index) => ({
      ...task,
      status: index === 0 ? ('DONE' as const) : ('REVIEW' as const),
      estimatedHours: 1.5,
      spentHours: undefined,
    }));
    expect(summarizeTasks(tasks)).toEqual({
      completed: 1,
      progress: 33,
      estimated: 4.5,
      logged: 0,
    });
  });
});
