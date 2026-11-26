import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { listSubmissionHistory } from '../api/submission-history.api';
import { createSubmissionHistoryStore, watchSubmissionHistory } from '../model/submission-history.store';

export function useSubmissionHistory(userId: string | undefined, project: string, task: string, active: boolean,
    taskVersion?: number, revision = 0) {
  // Successful local transitions create a new scope at page zero; background updates retain this scope.
  const scope = useMemo(() => ({ userId, project, task, revision }), [userId, project, task, revision]);
  const store = useMemo(() => createSubmissionHistoryStore(page => {
    if (!scope.userId) return Promise.reject(new Error('Phiên đăng nhập không còn hiệu lực.'));
    return listSubmissionHistory(scope.userId, scope.project, scope.task, page);
  }), [scope]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    if (!active || !userId) return;
    void store.refresh();
    const updates = watchSubmissionHistory(window, () => void store.refresh(), () => !document.hidden);
    const visible = () => { if (!document.hidden) updates.schedule(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      updates.stop();
      document.removeEventListener('visibilitychange', visible);
      store.cancel();
    };
  }, [store, active, userId, taskVersion]);
  return { ...state, refresh: store.refresh, setPage: store.setPage, onFileError: store.handleFileError };
}
