import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../auth', () => ({
  authenticatedAccessToken: vi.fn().mockResolvedValue('time-token'),
}));
import { addManualTime, editTime, readTimeRevisions } from './timesheet.api';
import { authenticatedAccessToken } from '../../auth';
const input = {
  startedAt: '2026-10-29T01:00:00Z',
  endedAt: '2026-10-29T02:00:00Z',
  reason: 'Quên ghi giờ',
};
describe('timesheet API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  it('sends real task/project IDs and ISO times with an authenticated request', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: 10 }));
    vi.stubGlobal('fetch', fetch);
    await addManualTime('u1', '7', '42', input);
    expect(authenticatedAccessToken).toHaveBeenCalledWith('u1');
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/work/projects/7/tasks/42/time-entries',
    );
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer time-token' },
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(input);
  });
  it('includes the original entry version when editing', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: null }));
    vi.stubGlobal('fetch', fetch);
    await editTime('u1', 7, 10, 4, input);
    expect(fetch.mock.calls[0][0]).toBe('/api/work/projects/7/time-entries/10');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      ...input,
      version: 4,
    });
  });
  it.each([403, 409])(
    'does not treat HTTP %s as a saved edit',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            Response.json({ message: 'Không thể lưu' }, { status }),
          ),
      );
      await expect(editTime('u1', 7, 10, 4, input)).rejects.toMatchObject({
        status,
      });
    },
  );
  it('reads persisted revisions from the protected endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetch);
    await expect(readTimeRevisions('u1')).resolves.toEqual([]);
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/work/projects/workspace/time-revisions',
    );
  });
});
