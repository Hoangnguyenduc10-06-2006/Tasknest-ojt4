import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
const user = { id: '00000000-0000-4000-8000-000000000007', fullName: 'Current User', email: 'user@example.com', emailVerified: true };
const sessionResponse = () => Response.json({ success: true, data: user });
const tokenResponse = (token: string) => Response.json({ success: true, data: { accessToken: token, expiresIn: 900, tokenType: 'Bearer' } });

describe('Identity API through Gateway', () => {
  it('registers with canonical API and never falls back to a preview on failure', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ message: 'Email đã tồn tại' }, { status: 409 }));
    vi.stubGlobal('fetch', fetch);
    const { registerAccount } = await import('./auth.api');
    await expect(registerAccount({ fullName: 'Nguyen An', email: 'an@example.com', password: 'password123', confirmPassword: 'password123' })).rejects.toMatchObject({ status: 409, message: 'Email đã tồn tại' });
    expect(fetch.mock.calls[0][0]).toBe('/api/identity/auth/register');
    expect(fetch.mock.calls[0][1].credentials).toBe('same-origin');
  });
  it('keeps access token in memory and coordinates concurrent refresh calls with CSRF', async () => {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-test' });
    const fetch = vi.fn().mockResolvedValueOnce(tokenResponse('access-one')).mockResolvedValueOnce(sessionResponse())
      .mockResolvedValueOnce(Response.json({ stage: 'ready' })).mockResolvedValueOnce(tokenResponse('access-two'));
    vi.stubGlobal('fetch', fetch);
    const { login, getAccessToken, refreshSession } = await import('./auth.api');
    await login(' USER@Example.com ', 'secret');
    expect(getAccessToken()).toBe('access-one');
    expect(fetch.mock.calls[1][0]).toBe('/api/identity/auth/session');
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer access-one');
    expect(JSON.parse(fetch.mock.calls[0][1].body).email).toBe('user@example.com');
    const first = refreshSession(); const second = refreshSession();
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls[3][1].headers['X-XSRF-TOKEN']).toBe('csrf-test');
    expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({});
    expect(getAccessToken()).toBe('access-two');
  });
  it('preserves unverified-email error code and never stores a token from an error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Xác nhận email', data: { code: 'EMAIL_NOT_VERIFIED' } }, { status: 403 })));
    const { login, getAccessToken } = await import('./auth.api');
    await expect(login('user@example.com', 'secret')).rejects.toMatchObject({ status: 403, code: 'EMAIL_NOT_VERIFIED' });
    expect(getAccessToken()).toBeNull();
  });
});

describe('session restoration and invalidation', () => {
  it('rejects anonymous restoration and never marks an HTTP failure as signed in', async () => {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-test' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({ message: 'No refresh cookie' }, { status: 401 })));
    const { checkSession } = await import('./auth.api');
    const { getSessionSnapshot } = await import('../model/session.store');
    expect(getSessionSnapshot().status).toBe('checking');
    await checkSession();
    expect(getSessionSnapshot().status).toBe('guest');
  });
  it('restores a reload only after the server validates the current user', async () => {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-test' });
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(tokenResponse('restored'))
      .mockResolvedValueOnce(sessionResponse());
    vi.stubGlobal('fetch', fetch);
    const { checkSession } = await import('./auth.api');
    const { getSessionSnapshot } = await import('../model/session.store');
    await Promise.all([checkSession(), checkSession()]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(getSessionSnapshot()).toMatchObject({ status: 'authenticated', user });
  });
  it('blocks protected content on network/server errors instead of using a local fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network down')));
    const { checkSession } = await import('./auth.api');
    const { getSessionSnapshot } = await import('../model/session.store');
    await checkSession();
    expect(getSessionSnapshot().status).toBe('error');
  });
  it('does not let an in-flight session check restore access after logout', async () => {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-test' });
    let resolveCheck: (value: Response) => void = () => {};
    const deferred = new Promise<Response>((resolve) => { resolveCheck = resolve; });
    const fetch = vi.fn().mockResolvedValueOnce(tokenResponse('access-one')).mockResolvedValueOnce(sessionResponse())
      .mockReturnValueOnce(deferred).mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json({ success: true }));
    vi.stubGlobal('fetch', fetch);
    const { login, logout, checkSession, getAccessToken } = await import('./auth.api');
    const { getSessionSnapshot } = await import('../model/session.store');
    await login('user@example.com', 'secret');
    const checking = checkSession();
    await logout();
    resolveCheck(sessionResponse()); await checking;
    expect(getAccessToken()).toBeNull();
    expect(getSessionSnapshot().status).toBe('guest');
  });
});

describe('embedded-browser refresh coordination', () => {
  it('falls back if Web Locks is denied before any refresh request starts', async () => {
    vi.stubGlobal('navigator', { locks: { request: vi.fn().mockRejectedValue(new DOMException('Unavailable', 'SecurityError')) } });
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-test' });
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(tokenResponse('restored'))
      .mockResolvedValueOnce(sessionResponse());
    vi.stubGlobal('fetch', fetch);
    const { checkSession } = await import('./auth.api');
    const { getSessionSnapshot } = await import('../model/session.store');
    await checkSession();
    expect(getSessionSnapshot().status).toBe('authenticated');
    expect(fetch.mock.calls.filter(([path]) => path === '/api/identity/auth/refresh-token')).toHaveLength(1);
  });
  it('does not retry a possibly consumed refresh token when the HTTP request fails', async () => {
    vi.stubGlobal('navigator', { locks: { request: (_name: string, callback: () => Promise<unknown>) => callback() } });
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-test' });
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({})).mockRejectedValueOnce(new TypeError('Connection lost'));
    vi.stubGlobal('fetch', fetch);
    const { checkSession } = await import('./auth.api');
    const { getSessionSnapshot } = await import('../model/session.store');
    await checkSession();
    expect(getSessionSnapshot().status).toBe('error');
    expect(fetch.mock.calls.filter(([path]) => path === '/api/identity/auth/refresh-token')).toHaveLength(1);
  });
});

describe('automatic email verification', () => {
  it('shares one in-flight request for a one-time verification link', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ success: true, data: { email: 'user@example.com', verified: true } }));
    vi.stubGlobal('fetch', fetch);
    const { verifyEmail } = await import('./auth.api');
    const first = verifyEmail('single-use-token'); const second = verifyEmail('single-use-token');
    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ data: { verified: true } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not treat a successful HTTP status without confirmed verification as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, data: { email: 'user@example.com', verified: false } })));
    const { verifyEmail } = await import('./auth.api');
    await expect(verifyEmail('token')).rejects.toThrow('Không thể xác nhận');
  });
  it('keeps expired/invalid links as errors instead of redirecting as verified', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Liên kết đã hết hạn' }, { status: 400 })));
    const { verifyEmail } = await import('./auth.api');
    await expect(verifyEmail('expired')).rejects.toMatchObject({ status: 400 });
  });
});

describe('final seconds of an absolute session lifetime', () => {
  it('uses a 20 second token until expiry without repeatedly refreshing on checks', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-test' });
      const fetch = vi.fn().mockImplementation(async (path: string) => path.endsWith('/session')
        ? sessionResponse() : Response.json({ success: true, data: { accessToken: 'short', expiresIn: 20 } }));
      vi.stubGlobal('fetch', fetch);
      const { login, checkSession } = await import('./auth.api');
      const { getSessionSnapshot } = await import('../model/session.store');
      await login('user@example.com', 'secret');
      for (let i = 0; i < 40; i++) await checkSession();
      expect(fetch.mock.calls.filter(([path]) => path.endsWith('/refresh-token'))).toHaveLength(0);
      expect(getSessionSnapshot()).toMatchObject({ status: 'authenticated', refreshAt: Date.now() + 20000 });
      vi.advanceTimersByTime(20001);
      await checkSession();
      expect(fetch.mock.calls.filter(([path]) => path.endsWith('/refresh-token'))).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });
});
