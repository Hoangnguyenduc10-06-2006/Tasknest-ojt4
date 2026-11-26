import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ token: vi.fn(), request: vi.fn() }));
vi.mock('../../auth', () => ({ authenticatedAccessToken: mocks.token }));
vi.mock('../../../shared/api/client', () => ({ requestJson: mocks.request }));
import {
  changeProjectShareLink,
  inviteProjectMember,
  listProjectMembers,
  projectJoinUrl,
} from './project-members.api';
import { requiresSession, safeReturnTo } from '../../../app/router/routes';
describe('project member API boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.token.mockResolvedValue('session-token');
    mocks.request.mockResolvedValue({ data: 42 });
  });
  it('normalizes recipient email without offering a role override', async () => {
    expect(
      await inviteProjectMember('user', '12', ' Member@Example.com '),
    ).toBe(42);
    expect(mocks.request).toHaveBeenCalledWith(
      '/api/work/projects/12/invitations',
      {
        accessToken: 'session-token',
        method: 'POST',
        body: { email: 'member@example.com' },
      },
    );
  });
  it('rejects mock project aliases before requesting credentials', async () => {
    await expect(
      listProjectMembers('user', 'p1', 'members', 0, 20),
    ).rejects.toThrow('ID dự án');
    expect(mocks.token).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('propagates failed invitations so the form can remain open for retry', async () => {
    mocks.request.mockRejectedValue(new Error('Lời mời đang chờ phản hồi'));
    await expect(
      inviteProjectMember('user', '12', 'member@example.com'),
    ).rejects.toThrow('đang chờ');
  });
  it('preserves the QR destination through authentication and rejects foreign redirects', () => {
    const path = '/join/' + 'a'.repeat(64);
    expect(projectJoinUrl('https://tasknest.example', 'a'.repeat(64))).toBe(
      'https://tasknest.example' + path,
    );
    expect(requiresSession(path)).toBe(true);
    expect(safeReturnTo(path)).toBe(path);
    expect(safeReturnTo('//foreign.example' + path)).toBe('/dashboard');
    expect(safeReturnTo('/join/mock-invite')).toBe('/dashboard');
  });
  it('requires an authenticated write to rotate shared links', async () => {
    await changeProjectShareLink('user', '12', 'ROTATE');
    expect(mocks.request).toHaveBeenCalledWith(
      '/api/work/projects/12/invitation-link',
      {
        accessToken: 'session-token',
        method: 'PUT',
        body: { action: 'ROTATE' },
      },
    );
  });
});
