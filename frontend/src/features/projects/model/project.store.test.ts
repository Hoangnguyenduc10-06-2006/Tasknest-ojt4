import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../api/project.api', () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  archiveProject: vi.fn(),
  reopenProject: vi.fn(),
}));
import {
  archiveProject,
  listProjects,
  reopenProject,
  type ProjectApiResponse,
} from '../api/project.api';
import {
  acceptProject,
  archiveStoredProject,
  clearProjects,
  getProjectSnapshot,
  loadProjects,
  reopenStoredProject,
} from './project.store';
const project = (id: number, version = 0): ProjectApiResponse => ({ id, version, name: 'Dự án thật', description: 'Mô tả dự án thật', ownerUserId: 'user-a', managerUserId: null, status: 'ACTIVE', role: 'OWNER', startsOn: '2026-10-19', endsOn: '2026-11-15', hasAvatar: false, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z' });
afterEach(() => { clearProjects(); vi.resetAllMocks(); });
describe('project server cache', () => {
  it('uses backend IDs, current role and version without sample projects', async () => {
    vi.mocked(listProjects).mockResolvedValue([project(42, 3)]);
    await loadProjects('user-a');
    expect(getProjectSnapshot().projects).toMatchObject([{ id: '42', role: 'Owner', version: 3 }]);
  });
  it('keeps projects beyond the first page available to navigation and updates the full collection after creation', async () => {
    vi.mocked(listProjects).mockResolvedValue(Array.from({ length: 25 }, (_, index) => project(index + 1)));
    await loadProjects('user-a');
    expect(getProjectSnapshot().projects).toHaveLength(25);
    expect(getProjectSnapshot().projects.find(item => item.id === '25')).toBeDefined();
    acceptProject('user-a', project(26));
    expect(getProjectSnapshot().projects).toHaveLength(26);
    acceptProject('user-a', project(26, 1));
    expect(getProjectSnapshot().projects).toHaveLength(26);
  });
  it('keeps loaded forms mounted while refreshing the same account', async () => {
    vi.mocked(listProjects).mockResolvedValueOnce([project(1)]);
    await loadProjects('user-a');
    let resolve!: (data: ProjectApiResponse[]) => void;
    vi.mocked(listProjects).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const refresh = loadProjects('user-a');
    expect(getProjectSnapshot()).toMatchObject({ status: 'ready', userId: 'user-a' });
    expect(getProjectSnapshot().projects).toHaveLength(1);
    resolve([project(1, 2)]);
    await refresh;
    expect(getProjectSnapshot().projects[0].version).toBe(2);
  });
  it('discards a response after logout and never accepts a previous account write', async () => {
    let resolve!: (data: ProjectApiResponse[]) => void;
    vi.mocked(listProjects).mockImplementation(() => new Promise(done => { resolve = done; }));
    const request = loadProjects('user-a');
    clearProjects(); resolve([project(1)]); await request;
    acceptProject('user-a', project(1));
    expect(getProjectSnapshot().projects).toEqual([]);
  });
  it('a delayed list cannot overwrite a successful save', async () => {
    let resolve!: (data: ProjectApiResponse[]) => void;
    vi.mocked(listProjects).mockImplementation(() => new Promise(done => { resolve = done; }));
    const request = loadProjects('user-a');
    acceptProject('user-a', project(1, 4));
    resolve([project(1, 2)]); await request;
    expect(getProjectSnapshot().projects[0].version).toBe(4);
  });
  it('clears cached projects when switching accounts or when permission lookup fails', async () => {
    vi.mocked(listProjects).mockResolvedValueOnce([project(1)]).mockRejectedValueOnce(new Error('Không có quyền'));
    await loadProjects('user-a');
    const request = loadProjects('user-b');
    expect(getProjectSnapshot().projects).toEqual([]);
    await request;
    expect(getProjectSnapshot()).toMatchObject({ status: 'error', projects: [] });
  });
  it('archives and reopens stored projects with version and updates the snapshot', async () => {
    vi.mocked(listProjects).mockResolvedValue([project(7, 1)]);
    await loadProjects('user-a');

    vi.mocked(archiveProject).mockResolvedValue({ ...project(7, 2), status: 'ARCHIVED' });
    await archiveStoredProject('user-a', '7', 1);
    expect(archiveProject).toHaveBeenCalledWith('user-a', '7', 1);
    expect(getProjectSnapshot().projects[0]).toMatchObject({ id: '7', status: 'ARCHIVED', version: 2 });

    vi.mocked(reopenProject).mockResolvedValue({ ...project(7, 3), status: 'ACTIVE' });
    await reopenStoredProject('user-a', '7', 2);
    expect(reopenProject).toHaveBeenCalledWith('user-a', '7', 2);
    expect(getProjectSnapshot().projects[0]).toMatchObject({ id: '7', status: 'ACTIVE', version: 3 });
  });
});
