import { describe, expect, it } from 'vitest';
import { projectHealth } from './project-health';
import type { Task } from '../../tasks';

const task = (overrides: Partial<Task> = {}): Task => ({ id: '1', code: 'TSK-1', projectId: '1', title: 'Việc', description: '', assignee: { id: 'u1', name: 'An', role: 'Member' }, priority: 'MEDIUM', status: 'IN_PROGRESS', estimatedHours: 2, createdAt: '2026-11-01T00:00:00Z', ...overrides });
describe('project health', () => {
  it('links each real task to its current warnings without counting it twice in the list', () => {
    const health = projectHealth([task({ deadline: '2026-11-01', isBlocked: true, decision: { score: 70, level: 'high', reasons: [], nextStep: '' } })], new Date('2026-11-16T00:00:00Z'));
    expect(health).toMatchObject({ open: 1, overdue: 1, blocked: 1, risky: 1 });
    expect(health.attention).toHaveLength(1);
    expect(health.attention[0].reasons).toEqual(['Bị chặn', 'Quá hạn thực hiện', 'Rủi ro cao']);
  });
  it('excludes closed tasks and distinguishes late review from late execution', () => {
    const deadline = '2026-11-15';
    const health = projectHealth([
      task({ id: '1', deadline, status: 'DONE', isBlocked: true }),
      task({ id: '2', deadline, status: 'CANCELLED' }),
      task({ id: '3', deadline, status: 'REVIEW' }),
      task({ id: '4', deadline: '2026-11-16' }),
    ], new Date('2026-11-15T18:00:00Z'));
    expect(health).toMatchObject({ open: 2, overdue: 1, blocked: 0, risky: 0 });
    expect(health.attention).toMatchObject([{ task: { id: '3' }, reasons: ['Chờ duyệt quá hạn'] }]);
  });
});
