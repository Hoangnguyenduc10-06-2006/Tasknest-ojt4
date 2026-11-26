import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../auth', () => ({ authenticatedAccessToken: vi.fn().mockResolvedValue('session-token') }));
import { askAi, getDashboardBrief, getTaskBrief } from './ai.api';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('uses Gateway and current identity, sending no client business context', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ data: { text: 'Gợi ý', model: 'model', sources: [{ label: 'TSK-2', href: '/tasks/2' }] } }));
  vi.stubGlobal('fetch', fetch);
  await expect(askAi('user', 'Phân tích', 2)).resolves.toMatchObject({ text: 'Gợi ý' });
  expect(fetch.mock.calls[0][0]).toBe('/api/ai/chat');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer session-token');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ message: 'Phân tích', taskId: 2, includeWorkspace: true });
});
it('does not retry provider quota errors', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ message: 'Hết hạn mức' }, { status: 429 }));
  vi.stubGlobal('fetch', fetch);
  await expect(askAi('user', 'hello')).rejects.toMatchObject({ status: 429, message: 'Hết hạn mức' });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([null, {}, { data: { text: 42 } }, { data: { text: '   ' } }])(
  'rejects malformed chat replies before rendering (%j)',
  async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
    await expect(askAi('user', 'Công việc hôm nay?')).rejects.toThrow('Trợ lý chưa trả về nội dung hợp lệ');
  },
);

it('renders a chat reply returned without task sources', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: { text: 'Gợi ý' } })));
  await expect(askAi('user', 'Công việc hôm nay?')).resolves.toMatchObject({ text: 'Gợi ý', sources: [] });
});

it('keeps only well-formed task links in chat replies', async () => {
  const task = { label: 'TSK-2', href: '/tasks/2' };
  const sources = [null, task, { href: '/tasks/3' }, { label: 'URL', href: 'https://example.test' }];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ data: { text: 'Gợi ý', sources } })));
  await expect(askAi('user', 'Công việc hôm nay?')).resolves.toMatchObject({ sources: [task] });
});

it('dashboard uses authenticated POST without client supplied business data', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ data: { text: 'Plan', counts: {}, sources: [], generatedAt: '2026-11-05T00:00:00Z' } }));
  vi.stubGlobal('fetch', fetch);
  await getDashboardBrief('user');
  expect(fetch.mock.calls[0][0]).toBe('/api/ai/dashboard');
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer session-token' } });
  expect(fetch.mock.calls[0][1].body).toBeUndefined();
});

it('coalesces automatic dashboard requests for the same user', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ data: { text: 'Plan', counts: {}, sources: [], generatedAt: '2026-11-05T00:00:00Z' } }));
  vi.stubGlobal('fetch', fetch);
  const first = getDashboardBrief('automatic-user');
  const second = getDashboardBrief('automatic-user');
  expect(first).toBe(second);
  await Promise.all([first, second]);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('task insights use current session and coalesce matching task requests', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ data: { insights: { nextStep: 'Kiểm tra deadline' } } }));
  vi.stubGlobal('fetch', fetch);
  const first = getTaskBrief('viewer', 2, 'version-1');
  expect(getTaskBrief('viewer', 2, 'version-1')).toBe(first);
  await first;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('/api/ai/tasks/2');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer session-token');
  expect(fetch.mock.calls[0][1].body).toBeUndefined();
});
