import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getJson, requestBlob, requestJson } from './client';
afterEach(() => vi.unstubAllGlobals());
describe('Gateway client', () => {
  it('reports HTTP errors instead of treating them as successful data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    await expect(getJson('/api/work/status')).rejects.toBeInstanceOf(ApiError);
  });
  it('rejects external URLs before sending credentials', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(getJson('https://example.com/api/work')).rejects.toThrow('không hợp lệ');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the Gateway and propagates a caller cancellation signal', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ stage: 'scaffold' })); vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    await expect(getJson('/api/status', controller.signal)).resolves.toEqual({ stage: 'scaffold' });
    expect(fetch.mock.calls[0][0]).toBe('/api/status');
    controller.abort();
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('preserves server errors when a report download is denied or too large', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Chọn khoảng ngày ngắn hơn.', code: 'REPORT_TOO_LARGE' }, { status: 422 })));
    await expect(requestBlob('/api/work/projects/7/reports/export', 'session')).rejects.toMatchObject({ status: 422, code: 'REPORT_TOO_LARGE', message: 'Chọn khoảng ngày ngắn hơn.' });
  });

  it('sends authenticated JSON bodies with DELETE requests', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: { removed: true } }));
    vi.stubGlobal('fetch', fetch);
    await expect(requestJson('/api/work/community/chat/4/messages/9/reaction', {
      method: 'DELETE',
      body: { emoji: '❤️' },
      accessToken: 'session',
    })).resolves.toEqual({ data: { removed: true } });
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '❤️' }),
    });
  });

});
