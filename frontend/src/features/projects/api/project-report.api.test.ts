import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedAccessToken } from '../../auth';
import { requestBlob } from '../../../shared/api/client';
import { exportProjectReport } from './project-report.api';
vi.mock('../../auth', () => ({ authenticatedAccessToken: vi.fn() }));
vi.mock('../../../shared/api/client', () => ({ requestBlob: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(authenticatedAccessToken).mockResolvedValue('session-token');
});

describe('project report download', () => {
  it('downloads the selected report with authentication and a stable filename', async () => {
    const blob = new Blob(['report'], { type: 'text/csv;charset=UTF-8' });
    vi.mocked(requestBlob).mockResolvedValue(blob);
    const result = await exportProjectReport('7', 'TIME', '2026-11-01', '2026-11-04');
    expect(requestBlob).toHaveBeenCalledWith('/api/work/projects/7/reports/export?type=TIME&from=2026-11-01&to=2026-11-04', 'session-token');
    expect(result).toEqual({ blob, filename: 'tasknest-project-7-time-2026-11-01-2026-11-04.csv' });
  });
  it('rejects an invalid period before requesting credentials or a report', async () => {
    await expect(exportProjectReport('7', 'TASKS', '2026-11-05', '2026-11-04')).rejects.toThrow('sau');
    expect(authenticatedAccessToken).not.toHaveBeenCalled();
    expect(requestBlob).not.toHaveBeenCalled();
  });
  it('keeps the sprint report request and filename stable', async () => {
    const blob = new Blob(['report'], { type: 'text/csv;charset=UTF-8' });
    vi.mocked(requestBlob).mockResolvedValue(blob);
    const result = await exportProjectReport('7', 'SPRINT', '2026-11-01', '2026-11-04');
    expect(requestBlob).toHaveBeenCalledWith('/api/work/projects/7/reports/export?type=SPRINT&from=2026-11-01&to=2026-11-04', 'session-token');
    expect(result.filename).toBe('tasknest-project-7-sprint-2026-11-01-2026-11-04.csv');
  });
  it('does not download JSON or HTML as a successful CSV', async () => {
    vi.mocked(requestBlob).mockResolvedValue(new Blob(['error page'], { type: 'text/html' }));
    await expect(exportProjectReport('7', 'TASKS', '2026-11-01', '2026-11-04')).rejects.toThrow('CSV');
  });
});
