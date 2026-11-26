import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, requestJson } from '../../../shared/api/client';
import {
  loadOrganization,
  saveOrganization,
  organizationSnapshot,
} from './task-organization.api';
vi.mock('../../../shared/api/client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../shared/api/client')>();
  return { ...actual, requestJson: vi.fn() };
});
vi.mock('../../auth', () => ({
  authenticatedAccessToken: vi.fn(async (user: string) => 'token-' + user),
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
const initial = { version: 0, checklist: [], tags: [], canEdit: true };
describe('shared task organization', () => {
  it('saves confirmed server snapshots and scopes the cache to each account', async () => {
    vi.stubGlobal('window', new EventTarget());
    vi.mocked(requestJson)
      .mockResolvedValueOnce({ data: initial })
      .mockResolvedValueOnce({
        data: { ...initial, version: 1, tags: ['BACKEND'] },
      });
    await loadOrganization('a', '1', '2');
    expect(
      await saveOrganization('a', '1', '2', (data) => ({
        checklist: data.checklist,
        tags: ['BACKEND'],
      })),
    ).toBe(true);
    expect(vi.mocked(requestJson).mock.calls[1][1]).toMatchObject({
      accessToken: 'token-a',
      method: 'PUT',
      body: { version: 0, tags: ['BACKEND'] },
    });
    expect(organizationSnapshot('a', '1', '2')?.data?.version).toBe(1);
    expect(organizationSnapshot('b', '1', '2')).toBeUndefined();
  });
  it('keeps the last confirmed version on conflict and requires a reload', async () => {
    vi.stubGlobal('window', new EventTarget());
    vi.mocked(requestJson)
      .mockResolvedValueOnce({ data: { ...initial, version: 3 } })
      .mockRejectedValueOnce(new ApiError(409, 'Đã thay đổi.'));
    await loadOrganization('stale', '1', '3');
    expect(
      await saveOrganization('stale', '1', '3', (data) => ({
        checklist: data.checklist,
        tags: ['BUG'],
      })),
    ).toBe(false);
    expect(organizationSnapshot('stale', '1', '3')).toMatchObject({
      data: { version: 3, tags: [] },
      error: 'Đã thay đổi.',
      busy: false,
    });
    expect(await saveOrganization('stale', '1', '3', (data) => data)).toBe(
      false,
    );
    expect(requestJson).toHaveBeenCalledTimes(2);
  });
  it('does not send customer mutations and clears private data after access revocation', async () => {
    vi.mocked(requestJson)
      .mockResolvedValueOnce({ data: { ...initial, canEdit: false } })
      .mockRejectedValueOnce(new ApiError(404));
    await loadOrganization('customer', '1', '4');
    expect(await saveOrganization('customer', '1', '4', (data) => data)).toBe(
      false,
    );
    expect(requestJson).toHaveBeenCalledTimes(1);
    await loadOrganization('customer', '1', '4');
    expect(organizationSnapshot('customer', '1', '4')?.data).toBeUndefined();
  });
});
