import { useCallback } from 'react';
import { useSession } from '../../auth';
import type { Task } from '../../tasks/model/task.types';
import { getTaskBrief } from '../api/ai.api';
import { useAutomaticBrief } from './useAutomaticBrief';

export function useTaskAiBrief(task: Task, role: string, enabled: boolean) {
  const session = useSession();
  const userId = session.status === 'authenticated' ? session.user.id : undefined;
  const scopeKey = enabled ? JSON.stringify([task.id, task.version, task.status, task.deadline, task.estimatedHours, task.isBlocked, task.assignee.id, role]) : '';
  const loader = useCallback((viewer: string, scope: string) => getTaskBrief(viewer, Number(task.id), scope), [task.id]);
  return useAutomaticBrief(userId, scopeKey, loader);
}
