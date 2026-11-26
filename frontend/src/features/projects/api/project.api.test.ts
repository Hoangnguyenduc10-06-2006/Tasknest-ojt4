import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth', () => ({
  authenticatedAccessToken: vi.fn().mockResolvedValue('work-access-token'),
}));

import { authenticatedAccessToken } from '../../auth';
import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  listProjectPage,
  reopenProject,
  updateProject,
} from './project.api';

describe('updateProject API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sends PUT /api/work/projects/:id with normalized name, trimmed description, schedule dates, version, and returns the server version', async () => {
    const updatedProject = {
      id: 2,
      name: 'Website TaskNest v2',
      description: 'Thiết kế và phát triển trải nghiệm quản lý công việc mới.',
      ownerUserId: 'u-owner',
      managerUserId: 'u-manager',
      status: 'ACTIVE',
      role: 'MANAGER',
      startsOn: '2026-06-03',
      endsOn: '2026-08-30',
      hasAvatar: false,
      version: 2,
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-02T00:00:00Z',
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: updatedProject }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateProject('u-manager', '2', {
      name: '  Website   TaskNest v2  ',
      description:
        '  Thiết kế và phát triển trải nghiệm quản lý công việc mới.  ',
      startsOn: '2026-06-03',
      endsOn: '2026-08-30',
      version: 1,
    });

    expect(result).toEqual(updatedProject);
    expect(authenticatedAccessToken).toHaveBeenCalledWith('u-manager');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/work/projects/2');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      headers: {
        Authorization: 'Bearer work-access-token',
        'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      name: 'Website TaskNest v2',
      description: 'Thiết kế và phát triển trải nghiệm quản lý công việc mới.',
      startsOn: '2026-06-03',
      endsOn: '2026-08-30',
      version: 1,
    });
  });

  it('propagates 403/409 errors when Member or stale version or archived project is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        Response.json(
          {
            message: 'Bạn không có quyền thực hiện thao tác này.',
            data: { code: 'PROJECT_FORBIDDEN' },
          },
          { status: 403 },
        ),
      ),
    );

    await expect(
      updateProject('u-member', 7, {
        name: 'Website TaskNest',
        description:
          'Thiết kế và phát triển trải nghiệm quản lý công việc mới.',
        startsOn: '2026-06-03',
        endsOn: '2026-08-30',
        version: 1,
      }),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Bạn không có quyền thực hiện thao tác này.',
    });
  });
  it('rejects mock IDs before sending an HTTP request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const id of ['p-2', 'abc', '0', '-1', '1/2']) {
      await expect(getProject('u-owner', id)).rejects.toThrow('ID dự án');
      await expect(
        updateProject('u-owner', id, {
          name: 'Test',
          description: 'Mô tả hợp lệ.',
          startsOn: '2026-10-19',
          endsOn: '2026-11-15',
          version: 0,
        }),
      ).rejects.toThrow('ID dự án');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('returns page metadata separately and encodes backend role enums', async () => {
    const page = {
      content: [],
      page: 1,
      size: 10,
      totalElements: 12,
      totalPages: 2,
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: page }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      await listProjectPage('u-owner', {
        page: 1,
        size: 10,
        role: 'Owner',
        q: '  Dự án  ',
        sort: 'NAME_ASC',
      }),
    ).toEqual(page);
    const query = new URL(fetchMock.mock.calls[0][0], 'http://localhost')
      .searchParams;
    expect(query.get('role')).toBe('OWNER');
    expect(query.get('q')).toBe('Dự án');
    expect(query.get('page')).toBe('1');
    expect(query.get('size')).toBe('10');
    expect(query.get('sort')).toBe('NAME_ASC');
  });
  it('reads the signed-in user projects and creates using server IDs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: [] }))
      .mockResolvedValueOnce(Response.json({ data: { id: 42, version: 0 } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await listProjects('u-owner')).toEqual([]);
    expect(
      await createProject('u-owner', {
        name: ' TaskNest ',
        description: ' Mô tả dự án hợp lệ ',
        startDate: '2026-10-19',
        endDate: '2026-11-15',
      }),
    ).toEqual({ id: 42, version: 0 });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/work/projects/index');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty(
      'id',
    );
  });

  it('sends POST /api/work/projects/:id/archive and /reopen with version and returns updated server state', async () => {
    const archivedProject = {
      id: 7,
      name: 'Website TaskNest',
      description: 'Mô tả dự án hợp lệ',
      ownerUserId: 'u-owner',
      managerUserId: null,
      status: 'ARCHIVED',
      role: 'OWNER',
      startsOn: '2026-06-03',
      endsOn: '2026-08-30',
      hasAvatar: false,
      version: 2,
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-02T00:00:00Z',
    };
    const reopenedProject = {
      ...archivedProject,
      status: 'ACTIVE',
      version: 3,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: archivedProject }))
      .mockResolvedValueOnce(Response.json({ data: reopenedProject }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await archiveProject('u-owner', '7', 1)).toEqual(archivedProject);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/work/projects/7/archive');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ version: 1 });

    expect(await reopenProject('u-owner', '7', 2)).toEqual(reopenedProject);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/work/projects/7/reopen');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ version: 2 });
  });
});
