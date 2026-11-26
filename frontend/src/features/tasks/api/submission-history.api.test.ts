import { afterEach, describe, expect, it, vi } from 'vitest';
import { authenticatedAccessToken } from '../../auth';
import { historyFixture } from '../mocks/submission-history.fixture';
import { listSubmissionHistory, downloadSubmissionFile } from './submission-history.api';
vi.mock('../../auth', () => ({ authenticatedAccessToken: vi.fn().mockResolvedValue('history-token') }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('submission history API', () => {
  it('requests a page through Gateway with the current account token', async () => {
    const data = historyFixture({ page: 1, size: 10, totalElements: 11, totalPages: 2 });
    const fetch = vi.fn().mockResolvedValue(Response.json({ data }));
    vi.stubGlobal('fetch', fetch);
    await expect(listSubmissionHistory('user', '7', '9', 1, 10)).resolves.toEqual(data);
    expect(authenticatedAccessToken).toHaveBeenCalledWith('user');
    expect(fetch.mock.calls[0][0]).toBe('/api/work/projects/7/tasks/9/submissions?page=1&size=10');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer history-token');
  });
  it('rejects invalid pages before making an authenticated request', async () => {
    await expect(listSubmissionHistory('user', '7', '9', -1)).rejects.toThrow('không hợp lệ');
    await expect(listSubmissionHistory('user', '7', '9', 2147483647, 50)).rejects.toThrow('không hợp lệ');
    expect(authenticatedAccessToken).not.toHaveBeenCalled();
  });
  it('propagates permission failures and malformed responses instead of showing an empty history', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Đã mất quyền' }, { status: 404 })));
    await expect(listSubmissionHistory('user', '7', '9')).rejects.toMatchObject({ status: 404 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: {} })));
    await expect(listSubmissionHistory('user', '7', '9')).rejects.toThrow('không hợp lệ');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: historyFixture({ page: 2, totalElements: 41, totalPages: 3 }) })));
    await expect(listSubmissionHistory('user', '7', '9')).rejects.toThrow('không đúng yêu cầu');
  });
  it('downloads through the exact task/submission file endpoint using Authorization', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'application/pdf' } }));
    vi.stubGlobal('fetch', fetch);
    const blob = await downloadSubmissionFile('user', '7', '9', 11);
    expect(blob.type).toBe('application/pdf');
    expect(fetch.mock.calls[0][0]).toBe('/api/work/projects/7/tasks/9/submissions/11/file');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer history-token');
    expect(authenticatedAccessToken).toHaveBeenCalledWith('user');
  });
  it('rejects missing/forbidden files and successful JSON error pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Không có tệp' }, { status: 404 })));
    await expect(downloadSubmissionFile('user', '7', '9', 11)).rejects.toMatchObject({ status: 404 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: true })));
    await expect(downloadSubmissionFile('user', '7', '9', 11)).rejects.toThrow('không hợp lệ');
  });

});
