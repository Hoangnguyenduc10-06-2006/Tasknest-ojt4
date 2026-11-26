import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/api/client';
import { historyFixture, submissionFixture } from '../mocks/submission-history.fixture';
import type { SubmissionHistoryPage } from './submission-history';
import { createSubmissionHistoryStore, watchSubmissionHistory } from './submission-history.store';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function settle() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
afterEach(() => vi.useRealTimers());

describe('submission synchronization', () => {
  it('coalesces in-flight invalidations and replaces data with the fresh response without duplicates', async () => {
    const first = deferred<SubmissionHistoryPage>();
    const second = deferred<SubmissionHistoryPage>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = createSubmissionHistoryStore(load);
    const request = store.refresh();
    void store.refresh();
    void store.refresh();
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    first.resolve(historyFixture());
    await request;
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().data).toBeUndefined();
    const latest = historyFixture({ content: [submissionFixture({ id: 12, number: 2 })] });
    second.resolve(latest);
    await settle();
    expect(store.getSnapshot().data).toEqual(latest);
    expect(store.getSnapshot().data?.content).toHaveLength(1);
  });

  it('ignores the response from an old page when the selected page changes during loading', async () => {
    const first = deferred<SubmissionHistoryPage>();
    const second = deferred<SubmissionHistoryPage>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = createSubmissionHistoryStore(load);
    const published: number[] = [];
    const unsubscribe = store.subscribe(() => { store.getSnapshot().data?.content.forEach(row => published.push(row.id)); });
    void store.refresh();
    await settle();
    store.setPage(1);
    first.resolve(historyFixture({ content: [submissionFixture({ id: 99 })] }));
    await settle();
    expect(load.mock.calls.map(call => call[0])).toEqual([0, 1]);
    second.resolve(historyFixture({ page: 1, totalElements: 21, totalPages: 2 }));
    await settle();
    expect(store.getSnapshot().page).toBe(1);
    expect(published).not.toContain(99);
    unsubscribe();
  });

  it('cancels obsolete requests on cleanup and cannot overwrite a later scope refresh', async () => {
    const old = deferred<SubmissionHistoryPage>();
    const latest = historyFixture({ content: [submissionFixture({ id: 12, number: 2 })] });
    const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(latest);
    const store = createSubmissionHistoryStore(load);
    void store.refresh();
    await settle();
    store.cancel();
    await store.refresh();
    old.resolve(historyFixture());
    await settle();
    expect(store.getSnapshot().data).toEqual(latest);
  });

  it('drops cached rows after permissions are revoked and allows a later retry', async () => {
    const load = vi.fn().mockResolvedValueOnce(historyFixture()).mockRejectedValueOnce(new ApiError(404, 'Removed'))
      .mockResolvedValueOnce(historyFixture());
    const store = createSubmissionHistoryStore(load);
    await store.refresh();
    expect(store.getSnapshot().data).toBeDefined();
    await store.refresh();
    expect(store.getSnapshot().data).toBeUndefined();
    expect(store.getSnapshot().error).toContain('quyền');
    await store.refresh();
    expect(store.getSnapshot().error).toBeUndefined();
    expect(store.getSnapshot().data).toBeDefined();
  });

  it('a forbidden file download also invalidates a still-pending successful list response', async () => {
    const old = deferred<SubmissionHistoryPage>();
    const store = createSubmissionHistoryStore(() => old.promise);
    void store.refresh();
    await settle();
    store.handleFileError(new ApiError(403));
    old.resolve(historyFixture());
    await settle();
    expect(store.getSnapshot().data).toBeUndefined();
    expect(store.getSnapshot().error).toContain('quyền');
  });

  it('reconciles a disappeared file instead of leaving the old download available', async () => {
    const changed = historyFixture({ content: [submissionFixture({ file: { id: 44, name: 'old.pdf', available: false } })] });
    const load = vi.fn().mockResolvedValueOnce(historyFixture()).mockResolvedValueOnce(changed);
    const store = createSubmissionHistoryStore(load);
    await store.refresh();
    store.handleFileError(new ApiError(404));
    expect(store.getSnapshot().data).toBeUndefined();
    await settle();
    expect(store.getSnapshot().data?.content[0].file?.available).toBe(false);
  });

  it('corrects a page that disappeared and retains the selected page during ordinary background updates', async () => {
    const load = vi.fn((page: number) => Promise.resolve(historyFixture({ page, content: [], totalElements: 0, totalPages: 0 })));
    const store = createSubmissionHistoryStore(load);
    store.setPage(2);
    await settle();
    expect(store.getSnapshot().page).toBe(0);
    expect(load.mock.calls.map(call => call[0])).toEqual([2, 0]);
    load.mockImplementation((page: number) => Promise.resolve(historyFixture({ page, totalElements: 41, totalPages: 3 })));
    store.setPage(1);
    await settle();
    await store.refresh();
    expect(store.getSnapshot().page).toBe(1);
    expect(load.mock.calls.at(-1)?.[0]).toBe(1);
  });

  it('keeps errors distinct from an empty history and isolates account/task stores', async () => {
    const old = createSubmissionHistoryStore(() => Promise.resolve(historyFixture()));
    await old.refresh();
    const next = createSubmissionHistoryStore(() => Promise.reject(new Error('Mất kết nối')));
    expect(next.getSnapshot().data).toBeUndefined();
    await next.refresh();
    expect(next.getSnapshot().error).toBe('Mất kết nối');
    expect(next.getSnapshot().data).toBeUndefined();
    expect(old.getSnapshot().data).toBeDefined();
  });
});

describe('existing realtime channel integration', () => {
  it('coalesces event bursts and unregisters all timers/listeners when results are inactive', () => {
    vi.useFakeTimers();
    const target = new EventTarget();
    const refresh = vi.fn();
    const watcher = watchSubmissionHistory(target, refresh);
    for (let count = 0; count < 20; count++) target.dispatchEvent(new Event('tasknest:sync'));
    vi.advanceTimersByTime(150);
    expect(refresh).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event('online'));
    watcher.stop();
    vi.advanceTimersByTime(60000);
    target.dispatchEvent(new Event('focus'));
    watcher.schedule();
    vi.advanceTimersByTime(150);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('polls only visible results and rechecks when focus or connectivity returns', () => {
    vi.useFakeTimers();
    const target = new EventTarget();
    const refresh = vi.fn();
    let visible = false;
    const watcher = watchSubmissionHistory(target, refresh, () => visible);
    vi.advanceTimersByTime(30150);
    expect(refresh).not.toHaveBeenCalled();
    visible = true;
    vi.advanceTimersByTime(30000);
    expect(refresh).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event('focus'));
    target.dispatchEvent(new Event('online'));
    vi.advanceTimersByTime(150);
    expect(refresh).toHaveBeenCalledTimes(2);
    watcher.stop();
  });
});
