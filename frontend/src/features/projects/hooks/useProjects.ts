import { useEffect, useSyncExternalStore } from 'react';
import { useSession } from '../../auth';
import { clearProjects, loadProjects, getProjectSnapshot, subscribeProjects } from '../model/project.store';

export function useProjectCollection(userId?: string) {
  const state = useSyncExternalStore(subscribeProjects, getProjectSnapshot);
  useEffect(() => {
    if (userId) void loadProjects(userId);
    else clearProjects();
    const sync=()=>{if(userId)void loadProjects(userId);};
    window.addEventListener('tasknest:sync',sync);
    return ()=>{window.removeEventListener('tasknest:sync',sync);clearProjects();};
  }, [userId]);
  return state.userId === userId ? state : { projects: EMPTY, status: 'idle' as const };
}
export function useProjects() {
  const state = useSyncExternalStore(subscribeProjects, getProjectSnapshot);
  const session = useSession();
  return session.status === 'authenticated' && state.userId === session.user.id ? state.projects : EMPTY;
}

const EMPTY: ReturnType<typeof getProjectSnapshot>['projects'] = [];
