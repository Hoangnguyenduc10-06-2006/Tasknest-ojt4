import { useEffect, useState } from 'react';
import { readTimeRevisions } from '../api/timesheet.api';
import type { TimeRevision } from '../model/timesheet.types';
export function useTimeRevisions(userId?: string, loadedAt?: number) {
  const key = `${userId}/${loadedAt}`;
  const [state, setState] = useState<{
    userId?: string;
    key?: string;
    rows: TimeRevision[];
    error?: string;
  }>({ rows: [] });
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void readTimeRevisions(userId)
      .then((rows) => {
        if (active) setState({ userId, key, rows });
      })
      .catch((error) => {
        if (active)
          setState({
            userId,
            key,
            rows: [],
            error:
              error instanceof Error
                ? error.message
                : 'Không thể tải lịch sử điều chỉnh giờ.',
          });
      });
    return () => {
      active = false;
    };
  }, [userId, key]);
  return {
    rows: state.userId === userId ? state.rows : [],
    error: state.key === key ? state.error : undefined,
    loading: !!userId && state.key !== key,
  };
}
