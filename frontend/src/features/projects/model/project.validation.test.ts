import { describe, expect, it } from 'vitest';
import {
  canArchiveOrReopenProject,
  canDevelopProject,
  developmentReadOnlyReason,
  canEditProject,
  formatProjectDateRange,
  generateProjectCode,
  getProjectReadOnlyReason,
  hasRunningTimerInProject,
  isProjectReadOnly,
  validateProjectArchiveAction,
  validateProjectForm,
} from './project.validation';
describe('validateProjectForm', () => {
  it('rejects short or empty name', () => {
    const result = validateProjectForm({
      name: 'ab',
      description: 'Mô tả dự án hợp lệ có trên 10 ký tự',
      startDate: '2026-10-01',
      endDate: '2026-11-01',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe('Tên dự án phải từ 3 đến 100 ký tự.');
  });

  it('rejects duplicate name among active projects of Owner', () => {
    const result = validateProjectForm(
      {
        name: 'Website TaskNest',
        description: 'Mô tả dự án hợp lệ có trên 10 ký tự',
        startDate: '2026-10-01',
        endDate: '2026-11-01',
      },
      ['Website TaskNest', 'Brand refresh'],
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toContain('Tên dự án đã tồn tại');
  });

  it('rejects short description under 10 characters', () => {
    const result = validateProjectForm({
      name: 'Hệ thống mới',
      description: 'Ngắn',
      startDate: '2026-10-01',
      endDate: '2026-11-01',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.description).toBe('Mô tả dự án phải từ 10 đến 500 ký tự.');
  });

  it('rejects end date before start date', () => {
    const result = validateProjectForm({
      name: 'Hệ thống mới',
      description: 'Mô tả dự án hợp lệ có trên 10 ký tự',
      startDate: '2026-11-01',
      endDate: '2026-10-01',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.endDate).toBe('Ngày kết thúc không được trước ngày bắt đầu.');
  });

  it('accepts valid project data with past start date', () => {
    const result = validateProjectForm({
      name: 'Dự án Cải tiến Portal 2026',
      description: 'Dự án nâng cấp toàn diện cổng thông tin dịch vụ nội bộ.',
      startDate: '2025-01-01',
      endDate: '2026-12-31',
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});

describe('generateProjectCode', () => {
  it('generates two-letter uppercase code from multi-word name', () => {
    expect(generateProjectCode('Website TaskNest')).toBe('WT');
    expect(generateProjectCode('Brand refresh')).toBe('BR');
  });

  it('generates two letters for single-word name', () => {
    expect(generateProjectCode('Growth')).toBe('GR');
  });
});

describe('canEditProject & updateProjectDetails (Owner/Manager only)', () => {
  it('allows only Owner and Manager of ACTIVE projects to edit details', () => {
    expect(canEditProject({ role: 'Owner', status: 'ACTIVE' })).toBe(true);
    expect(canEditProject({ role: 'Manager', status: 'ACTIVE' })).toBe(true);
    expect(canEditProject({ role: 'Member', status: 'ACTIVE' })).toBe(false);
    expect(canEditProject({ role: 'Owner', status: 'ARCHIVED' })).toBe(false);
    expect(canEditProject({ role: 'Manager', status: 'ARCHIVED' })).toBe(false);
    expect(isProjectReadOnly({ status: 'ACTIVE' })).toBe(false);
    expect(isProjectReadOnly({ status: 'ARCHIVED' })).toBe(true);
    expect(getProjectReadOnlyReason({ status: 'ACTIVE' })).toBeUndefined();
    expect(getProjectReadOnlyReason({ status: 'ARCHIVED' })).toContain(
      'chỉ được xem lại',
    );
  });

  it('formats schedule dates', () => {
    expect(formatProjectDateRange('2026-05-15', '2026-08-20')).toBe('15 thg 5, 2026 – 20 thg 8, 2026');
  });

  it('enforces Owner-only archive/reopen, version requirement, and blocks archiving when a timer is running', () => {
    expect(canArchiveOrReopenProject({ role: 'Owner' })).toBe(true);
    expect(canArchiveOrReopenProject({ role: 'Manager' })).toBe(false);
    expect(canArchiveOrReopenProject({ role: 'Member' })).toBe(false);

    const entriesWithRunningTimer = [
      { projectId: 7, endedAt: null },
      { projectId: 8, endedAt: '2026-10-20T10:00:00Z' },
    ];
    expect(hasRunningTimerInProject('7', entriesWithRunningTimer)).toBe(true);
    expect(hasRunningTimerInProject('8', entriesWithRunningTimer)).toBe(false);

    expect(
      validateProjectArchiveAction(
        { id: '7', role: 'Manager', status: 'ACTIVE', version: 1 },
        [],
      ),
    ).toContain('Chỉ Owner');

    expect(
      validateProjectArchiveAction(
        { id: '7', role: 'Owner', status: 'ACTIVE', version: undefined },
        [],
      ),
    ).toContain('Phiên bản dự án');

    expect(
      validateProjectArchiveAction(
        { id: '7', role: 'Owner', status: 'ACTIVE', version: 1 },
        entriesWithRunningTimer,
      ),
    ).toContain('phiên ghi giờ đang chạy');

    expect(
      validateProjectArchiveAction(
        { id: '7', role: 'Owner', status: 'ACTIVE', version: 1 },
        [{ projectId: 7, endedAt: '2026-10-20T10:00:00Z' }],
      ),
    ).toBeUndefined();

    expect(
      validateProjectArchiveAction(
        { id: '7', role: 'Owner', status: 'ARCHIVED', version: 2 },
        entriesWithRunningTimer,
      ),
    ).toBeUndefined();
  });
});

describe('project development lifecycle', () => {
  it('allows normal development and keeps customer/project archive restrictions', () => {
    expect(canDevelopProject({status: 'ACTIVE', role: 'Member'})).toBe(true);
    expect(canDevelopProject({status: 'ACTIVE', role: 'Customer'})).toBe(false);
    expect(canDevelopProject({status: 'ARCHIVED', role: 'Owner'})).toBe(false);
  });
  it('keeps pending kickoff and accepted projects out of task and time mutations', () => {
    for (const developmentState of ['PENDING_KICKOFF', 'COMPLETED'] as const) {
      const project = {status: 'ACTIVE' as const, role: 'Owner' as const, developmentState};
      expect(canDevelopProject(project)).toBe(false);
      expect(developmentReadOnlyReason(project)).toBeTruthy();
      expect(canEditProject(project)).toBe(developmentState === 'PENDING_KICKOFF');
      expect(canArchiveOrReopenProject(project)).toBe(developmentState === 'PENDING_KICKOFF');
    }
  });
});
