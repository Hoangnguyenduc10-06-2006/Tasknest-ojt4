import { useCallback, useEffect, useRef, useState } from 'react';
import { listProjectMembers } from '../api/project-members.api';
import type {
  ProjectMembersSnapshot,
  ProjectMemberTab,
} from '../model/project-member.types';
export function useProjectMembers(
  userId: string,
  projectId: string,
  tab: ProjectMemberTab,
  page: number,
  size: number,
) {
  const [state, setState] = useState<{
    key: string;
    data?: ProjectMembersSnapshot;
    error?: string;
  }>({ key: '' });
  const key = `${userId}/${projectId}/${tab}/${page}/${size}`;
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    try {
      const data = await listProjectMembers(userId, projectId, tab, page, size);
      if (request === generation.current) setState({ key, data });
    } catch (error) {
      if (request === generation.current)
        setState({
          key,
          error:
            error instanceof Error
              ? error.message
              : 'Không thể tải dữ liệu thành viên.',
        });
    }
  }, [userId, projectId, tab, page, size, key]);
  useEffect(() => {
    const initial = window.setTimeout(() => {
      void refresh();
    }, 0);
    const focus = () => {
      void refresh();
    };
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    window.addEventListener('focus', focus);
    const cancel = () => {
      generation.current++;
    };
    return () => {
      cancel();
      window.clearTimeout(initial);
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [refresh]);
  return { ...(state.key === key ? state : {}), refresh };
}
