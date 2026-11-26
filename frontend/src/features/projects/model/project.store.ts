import {
  archiveProject,
  createProject,
  listProjects,
  reopenProject,
  type ProjectApiResponse,
} from '../api/project.api';
import { mapProject } from './project.mapping';
import type { CreateProjectInput, MyProjectItem } from './project.types';

type Snapshot = {
  userId?: string;
  projects: MyProjectItem[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
};
const empty: MyProjectItem[] = [];
let snapshot: Snapshot = { projects: empty, status: 'idle' };
let generation = 0;
const listeners = new Set<() => void>();
export const subscribeProjects = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getProjectSnapshot = () => snapshot;
function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach(listener => listener());
}

export function clearProjects() {
  generation++;
  publish({ projects: empty, status: 'idle' });
}
export async function loadProjects(userId: string) {
  const request = ++generation;
  publish({ userId, projects: snapshot.userId === userId ? snapshot.projects : empty, status: snapshot.userId === userId && snapshot.status === 'ready' ? 'ready' : 'loading' });
  try {
    const data = await listProjects(userId);
    if (request !== generation) return;
    publish({ userId, projects: data.map(mapProject), status: 'ready' });
  } catch (error) {
    if (request !== generation) return;
    publish({
      userId, projects: empty, status: 'error',
      error: error instanceof Error ? error.message : 'Không thể tải dự án.',
    });
  }
}
export function acceptProject(userId: string, data: ProjectApiResponse) {
  if (snapshot.userId !== userId) return;
  // A list request started before this write must not replace its result.
  generation++;
  const project = mapProject(data);
  publish({
    userId, status: 'ready',
    projects: [project, ...snapshot.projects.filter(item => item.id !== project.id)],
  });
}
export async function createStoredProject(userId: string, input: CreateProjectInput) {
  const result = await createProject(userId, input);
  acceptProject(userId, result);
  return result;
}
export async function archiveStoredProject(
  userId: string,
  projectId: string | number,
  version: number,
) {
  const result = await archiveProject(userId, projectId, version);
  acceptProject(userId, result);
  return result;
}
export async function reopenStoredProject(
  userId: string,
  projectId: string | number,
  version: number,
) {
  const result = await reopenProject(userId, projectId, version);
  acceptProject(userId, result);
  return result;
}
