import { describe, expect, it, vi } from 'vitest';
import { createInboxRefresh } from './inbox-refresh';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe('inbox refresh', () => {
  it('applies a slow response during a burst and fetches the latest inbox afterward', async () => {
    const first = deferred();
    const second = deferred();
    const applied: number[] = [];
    const load = vi.fn()
      .mockImplementationOnce(async () => { await first.promise; applied.push(1); })
      .mockImplementationOnce(async () => { await second.promise; applied.push(2); });
    const refresh = createInboxRefresh(load);

    const completion = refresh();
    for (let index = 0; index < 20; index++) expect(refresh()).toBe(completion);
    expect(load).toHaveBeenCalledTimes(1);

    first.resolve();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(applied).toEqual([1]);
    second.resolve();
    await completion;
    expect(applied).toEqual([1, 2]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('allows another refresh after a failed request', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const refresh = createInboxRefresh(load);
    await expect(refresh()).rejects.toThrow('offline');
    await refresh();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
