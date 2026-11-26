import { ApiError } from '../../../shared/api/client';
import type { SubmissionHistoryPage } from './submission-history';

export interface SubmissionHistoryState {
  page: number;
  loading: boolean;
  data?: SubmissionHistoryPage;
  error?: string;
}

/** One store per account/project/task; requests and event bursts never append duplicate results. */
export function createSubmissionHistoryStore(load: (page: number) => Promise<SubmissionHistoryPage>) {
  let state: SubmissionHistoryState = { page: 0, loading: false };
  let generation = 0;
  let flight: Promise<void> | undefined;
  let queued = false;
  const listeners = new Set<() => void>();
  function publish(next: SubmissionHistoryState) {
    state = next;
    listeners.forEach(listener => listener());
  }
  function cancel() { generation++; flight = undefined; queued = false; }
  function fail(error: unknown) {
    cancel();
    const message = error instanceof ApiError && error.status === 401 ? 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.'
      : error instanceof ApiError && [403, 404].includes(error.status) ? 'Bạn không còn quyền xem lịch sử hoặc nhiệm vụ không còn khả dụng.'
        : error instanceof Error ? error.message : 'Không thể tải lịch sử kết quả.';
    publish({ page: state.page, loading: false, error: message });
  }
  function refresh(): Promise<void> {
    if (flight) { queued = true; return flight; }
    const request = ++generation;
    const page = state.page;
    publish({ ...state, error: undefined, loading: true });
    flight = (async () => {
      try {
        const data = await Promise.resolve().then(() => load(page));
        if (request !== generation || page !== state.page || queued) return;
        const lastPage = Math.max(0, data.totalPages - 1);
        if (page > lastPage) {
          publish({ page: lastPage, loading: true });
          queued = true;
        } else publish({ page, data, loading: false });
      } catch (error) {
        if (request === generation && page === state.page) {
          const message = error instanceof ApiError && [401, 403, 404].includes(error.status)
            ? 'Bạn không còn quyền xem lịch sử hoặc phiên đăng nhập đã hết hiệu lực.'
            : error instanceof Error ? error.message : 'Không thể tải lịch sử kết quả.';
          publish({ page, loading: false, error: message });
        }
      } finally {
        if (request === generation) {
          flight = undefined;
          if (queued) { queued = false; void refresh(); }
        }
      }
    })();
    return flight;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    setPage(page: number) {
      if (!Number.isSafeInteger(page) || page < 0 || page === state.page) return;
      publish({ page, loading: true });
      void refresh();
    },
    handleFileError(error: unknown) {
      if (!(error instanceof ApiError)) return;
      if ([401, 403].includes(error.status)) fail(error);
      else if (error.status === 404) {
        cancel();
        publish({ page: state.page, loading: true });
        void refresh();
      }
    },
    cancel,
  };
}

/** Reuse the app's invalidation channel; active results also reconcile after focus/online and on a quiet poll. */
export function watchSubmissionHistory(target: EventTarget, refresh: () => void, visible: () => boolean = () => true) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const schedule = () => {
    if (stopped || timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; refresh(); }, 150);
  };
  const events = ['tasknest:sync', 'focus', 'pageshow', 'online'];
  events.forEach(event => target.addEventListener(event, schedule));
  const poll = setInterval(() => { if (visible()) schedule(); }, 30000);
  return {
    schedule,
    stop() {
      stopped = true;
      events.forEach(event => target.removeEventListener(event, schedule));
      if (timer !== undefined) clearTimeout(timer);
      clearInterval(poll);
    },
  };
}
