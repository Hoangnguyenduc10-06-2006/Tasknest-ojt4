import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../auth', () => ({ authenticatedAccessToken: vi.fn().mockResolvedValue('access-token'), updateSessionUser: vi.fn() }));
import { authenticatedAccessToken, updateSessionUser } from '../../auth';
import { saveProfile } from './profile.api';
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('saves through Gateway with the current account, version, Bearer and CSRF', async () => {
  vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-token' });
  const user = { id: 'u1', fullName: 'New Name', email: 'user@example.test', emailVerified: true, version: 5 };
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json({ data: user }));
  vi.stubGlobal('fetch', fetch);
  await expect(saveProfile('u1', { fullName: 'New Name', jobTitle: 'Developer', bio: 'Hello' }, 4)).resolves.toEqual(user);
  expect(authenticatedAccessToken).toHaveBeenCalledWith('u1');
  expect(fetch.mock.calls[1][0]).toBe('/api/identity/profile');
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'PUT', headers: { Authorization: 'Bearer access-token', 'X-XSRF-TOKEN': 'csrf-token' } });
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ fullName: 'New Name', jobTitle: 'Developer', bio: 'Hello', version: 4 });
  expect(updateSessionUser).toHaveBeenCalledWith(user);
});
it('does not report success or overwrite the session when the server rejects stale data', async () => {
  vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-token' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json({ message: 'Conflict' }, { status: 409 })));
  await expect(saveProfile('u1', { fullName: 'New Name', jobTitle: '', bio: '' }, 1)).rejects.toMatchObject({ status: 409 });
  expect(updateSessionUser).not.toHaveBeenCalled();
});
