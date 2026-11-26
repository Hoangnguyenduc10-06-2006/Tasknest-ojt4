import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../auth', () => ({
  authenticatedAccessToken: vi.fn().mockResolvedValue('task-access-token'),
}));
import { getLatestTaskSubmission, transitionTask } from './task.api';
import { authenticatedAccessToken } from '../../auth';

describe('task workflow API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  it('sends a versioned transition through the gateway with the current authenticated identity', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: null }));
    vi.stubGlobal('fetch', fetch);
    const body = {
      status: 'REVIEW',
      version: 4,
      note: 'Kết quả kiểm thử',
      confirmed: false,
    };
    await transitionTask('u1', '7', '42', body);
    expect(authenticatedAccessToken).toHaveBeenCalledWith('u1');
    expect(fetch.mock.calls[0][0]).toBe('/api/work/projects/7/tasks/42/status');
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      headers: { Authorization: 'Bearer task-access-token' },
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);
  });
  it.each([
    { resultUrl: 'https://example.com/review' },
    { resultFileId: 123 },
  ])('preserves the selected deliverable in a submission request: %j', async (deliverable) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: null }));
    vi.stubGlobal('fetch', fetch);
    const body = { version: 2, status: 'REVIEW', note: 'Kết quả để duyệt', confirmed: false, ...deliverable };
    await transitionTask('u1', '7', '42', body);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);
  });
  it('loads the pending result note before a manager can review it', async () => {
    const submission = {
      number: 2,
      resultNote: 'Đã sửa theo phản hồi',
      decision: 'PENDING',
      submittedAt: '2026-10-29T00:00:00Z',
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ data: submission }));
    vi.stubGlobal('fetch', fetch);
    await expect(getLatestTaskSubmission('u1', '7', '42')).resolves.toEqual(
      submission,
    );
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/work/projects/7/tasks/42/submission',
    );
  });
  it.each([null, { resultNote: 'Đã xử lý', decision: 'ACCEPTED' }])(
    'refuses an absent or already processed result',
    async (data) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(Response.json({ data })),
      );
      await expect(getLatestTaskSubmission('u1', '7', '42')).rejects.toThrow(
        'không còn kết quả đang chờ duyệt',
      );
    },
  );
  it.each([403, 409])(
    'propagates HTTP %s instead of treating rejected writes as success',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            Response.json(
              { message: 'Không thể chuyển trạng thái.' },
              { status },
            ),
          ),
      );
      await expect(
        transitionTask('u1', '7', '42', {
          status: 'DONE',
          version: 4,
          note: '',
          confirmed: true,
        }),
      ).rejects.toMatchObject({
        status,
        message: 'Không thể chuyển trạng thái.',
      });
    },
  );
});
