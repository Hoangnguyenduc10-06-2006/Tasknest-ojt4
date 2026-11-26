import { useSession } from '../../auth';
import { useWorkspace } from '../../workspace';
import { getDashboardBrief } from '../api/ai.api';

import { useAutomaticBrief } from './useAutomaticBrief';
export function useDashboardAiBrief() {
  const session = useSession();
  const workspace = useWorkspace();
  const userId = session.status === 'authenticated' ? session.user.id : undefined;
  const scopeKey = userId && workspace.data && !workspace.error ? JSON.stringify([
    workspace.data.members.map(m => [m.projectId, m.id, m.role]),
    workspace.data.tasks.map(t => [t.id, t.title, t.assignee.id, t.status, t.deadline, t.estimatedHours, t.isBlocked]),
  ]) : '';
  return useAutomaticBrief(userId, scopeKey, getDashboardBrief);
}
