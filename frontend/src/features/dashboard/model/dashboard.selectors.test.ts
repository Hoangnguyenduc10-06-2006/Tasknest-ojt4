import { describe, expect, it } from 'vitest';
import { buildDashboard } from './dashboard.selectors';
import type { Task } from '../../tasks';
import type { MyProjectItem } from '../../projects';
const project: MyProjectItem = {
  id: '7',
  name: 'Dự án thật',
  code: 'DA',
  description: '',
  role: 'Owner',
  status: 'ACTIVE',
  progress: 0,
  dateRange: '',
  updatedAt: '',
  updatedAtMs: 0,
  iconBgClass: '',
};
const task = (
  id: string,
  status: Task['status'],
  deadline = '2026-10-28',
): Task => ({
  id,
  code: id,
  projectId: '7',
  title: id,
  description: '',
  assignee: { id: 'u', name: 'Người dùng', role: 'Owner', isCurrentUser: true },
  priority: 'MEDIUM',
  status,
  deadline,
  estimatedHours: 1,
  createdAt: '',
});
describe('dashboard from persisted data', () => {
  it('keeps own submissions separate from other members results needing review', () => {
    const own = task('own-review', 'REVIEW');
    const other = { ...task('other-review', 'REVIEW'), assignee: { id: 'other', name: 'Other', role: 'Member' as const } };
    const data = buildDashboard('Owner', [own, other], [project], []);
    expect(data.awaitingTasks?.map(task => task.id)).toEqual(['own-review']);
    expect(data.reviewTasks?.map(task => task.id)).toEqual(['other-review']);
    expect(data.stats.find(stat => stat.key === 'awaiting_review')?.count).toBe(1);
    expect(data.stats.find(stat => stat.key === 'needs_review')?.count).toBe(1);
  });
  it('includes other assignees pending review only in active projects managed by the viewer', () => {
    const pending = { ...task('member-review', 'REVIEW'), assignee: { id: 'other', name: 'Thành viên', role: 'Member' as const } };
    for (const role of ['Owner', 'Manager'] as const) {
      const data = buildDashboard('Lead', [pending], [{ ...project, role }], []);
      expect(data.stats.find(stat => stat.key === 'needs_review')?.count).toBe(1);
      expect(data.reviewTasks).toEqual([expect.objectContaining({ id: pending.id, canReview: true })]);
    }
    expect(buildDashboard('Member', [pending], [{ ...project, role: 'Member' }], []).reviewTasks).toEqual([]);
    expect(buildDashboard('Owner', [pending], [{ ...project, status: 'ARCHIVED' }], []).reviewTasks).toEqual([]);
  });
  it('uses Vietnam dates and excludes review from overdue execution', () => {
    const data = buildDashboard(
      'Tên thật',
      [
        task('late', 'IN_PROGRESS'),
        task('review', 'REVIEW'),
        task('soon', 'TODO', '2026-11-01'),
        {
          ...task('other', 'TODO'),
          assignee: { id: 'other', name: 'Other', role: 'Member' },
        },
      ],
      [project],
      [],
      Date.parse('2026-10-28T18:00:00Z'),
    );
    expect(data.userName).toBe('Tên thật');
    expect(data.stats).toEqual([
      { key: 'in_progress', count: 1 },
      { key: 'due_soon', count: 1 },
      { key: 'overdue', count: 1 },
      { key: 'awaiting_review', count: 1 },
      { key: 'needs_review', count: 0 },
    ]);
    expect(data.attentionTasks.map((task) => task.id)).toEqual(['late']);
  });
  it('excludes cancelled tasks from completion and calculates warning thresholds', () => {
    const data = buildDashboard(
      'User',
      [
        task('done', 'DONE'),
        task('cancelled', 'CANCELLED'),
        {
          ...task('risk', 'IN_PROGRESS', '2026-11-30'),
          spentHours: 0.8,
          isBlocked: true,
        },
        { ...task('over', 'IN_PROGRESS', '2026-11-30'), spentHours: 1.1 },
      ],
      [project],
      [],
      Date.parse('2026-10-28T00:00:00Z'),
    );
    expect(data.activeProjects[0]).toMatchObject({
      completedTasks: 1,
      eligibleTasks: 3,
    });
    expect(data.attentionTasks.find(task => task.id === 'risk')?.reasons).toEqual([
      'blocked',
      'estimate_risk',
    ]);
    expect(data.attentionTasks.find(task => task.id === 'over')?.reasons).toEqual(['over_estimate']);
  });
  it('shows an empty real workspace without a fabricated running timer or task', () => {
    const data = buildDashboard('New user', [], [], [], 0);
    expect(data.stats.every((stat) => stat.count === 0)).toBe(true);
    expect(data.activeProjects).toEqual([]);
    expect(data.attentionTasks).toEqual([]);
  });
});

it('ranks server decisions and excludes archived projects and other assignees', () => {
  const decision = (score: number) => ({ score, level: 'high' as const, reasons: ['Đến hạn hôm nay'], nextStep: 'Kiểm tra kế hoạch' });
  const first = { ...task('first', 'TODO'), decision: decision(35) };
  const urgent = { ...task('urgent', 'TODO'), decision: decision(85) };
  const data = buildDashboard('User', [first, urgent], [project], []);
  expect(data.attentionTasks.map(task => task.id)).toEqual(['urgent', 'first']);
  expect(buildDashboard('User', [urgent], [{ ...project, status: 'ARCHIVED' }], []).attentionTasks).toEqual([]);
});
