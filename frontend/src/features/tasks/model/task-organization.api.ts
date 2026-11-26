import { useEffect, useSyncExternalStore } from 'react';
import { authenticatedAccessToken } from '../../auth';
import { ApiError, requestJson } from '../../../shared/api/client';
import type { TaskChecklistItem } from './task-checklist';
export type Organization = {
  version: number;
  checklist: TaskChecklistItem[];
  tags: string[];
  canEdit: boolean;
};
type State = { data?: Organization; error?: string; busy: boolean };
const states = new Map<string, State>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
const revisions = new Map<string, number>();
const empty: State = { busy: false };
let tick = 0;
const emit = () => {
  tick++;
  listeners.forEach((listener) => listener());
};
const keyFor = (user: string, project: string, task: string) =>
  user + '/' + project + '/' + task;
async function api(
  user: string,
  project: string,
  task: string,
  body?: unknown,
) {
  const response = await requestJson<{ data: Organization }>(
    `/api/work/projects/${project}/tasks/${task}/organization`,
    {
      accessToken: await authenticatedAccessToken(user),
      method: body ? 'PUT' : 'GET',
      body,
    },
  );
  return response.data;
}
export async function loadOrganization(
  user: string,
  project: string,
  task: string,
) {
  const key = keyFor(user, project, task);
  if (pending.has(key)) return;
  pending.add(key);
  const revision = (revisions.get(key) ?? 0) + 1;
  revisions.set(key, revision);
  try {
    const data = await api(user, project, task);
    if (revisions.get(key) === revision) states.set(key, { data, busy: false });
  } catch (error) {
    if (revisions.get(key) === revision) {
      const previous = states.get(key);
      states.set(key, {
        data:
          error instanceof ApiError && [401, 403, 404].includes(error.status)
            ? undefined
            : previous?.data,
        busy: false,
        error:
          error instanceof Error
            ? error.message
            : 'Không thể tải checklist và nhãn.',
      });
    }
  } finally {
    pending.delete(key);
    emit();
  }
}
export async function saveOrganization(
  user: string,
  project: string,
  task: string,
  change: (data: Organization) => Pick<Organization, 'checklist' | 'tags'>,
) {
  const key = keyFor(user, project, task);
  const current = states.get(key);
  if (!current?.data?.canEdit || current.busy || current.error) return false;
  revisions.set(key, (revisions.get(key) ?? 0) + 1);
  states.set(key, { data: current.data, busy: true });
  emit();
  try {
    const data = await api(user, project, task, {
      version: current.data.version,
      ...change(current.data),
    });
    states.set(key, { data, busy: false });
    window.dispatchEvent(new Event('tasknest:sync'));
    return true;
  } catch (error) {
    states.set(key, {
      data: error instanceof ApiError && [401,403,404].includes(error.status) ? undefined : current.data,
      busy: false,
      error:
        error instanceof Error
          ? error.message
          : 'Không thể lưu checklist và nhãn.',
    });
    return false;
  } finally {
    emit();
  }
}
export function useTaskOrganization(
  user: string | undefined,
  project: string,
  task: string,
) {
  const key = keyFor(user ?? '', project, task);
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => states.get(key) ?? empty,
  );
  useEffect(() => {
    if (!user) return;
    const reload = () => {
      if (!document.hidden && !states.get(key)?.busy)
        void loadOrganization(user, project, task);
    };
    reload();
    window.addEventListener('tasknest:sync', reload);
    window.addEventListener('focus', reload);
    const timer = window.setInterval(reload, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('tasknest:sync', reload);
      window.removeEventListener('focus', reload);
    };
  }, [user, project, task, key]);
  return {
    ...state,
    reload: () =>
      user ? loadOrganization(user, project, task) : Promise.resolve(),
    save: (
      change: (data: Organization) => Pick<Organization, 'checklist' | 'tags'>,
    ) =>
      user
        ? saveOrganization(user, project, task, change)
        : Promise.resolve(false),
  };
}

export function useTaskOrganizations(
  user: string | undefined,
  tasks: { id: string; projectId?: string }[],
) {
  const signature = tasks
    .filter((task) => task.projectId)
    .map((task) => task.projectId + '/' + task.id)
    .join(',');
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => tick,
  );
  useEffect(() => {
    if (!user) return;
    const reload = () => {
      if (document.hidden) return;
      for (const pair of signature.split(',').filter(Boolean)) {
        const [project, task] = pair.split('/');
        void loadOrganization(user, project, task);
      }
    };
    reload();
    const timer = window.setInterval(reload, 30000);
    window.addEventListener('tasknest:sync', reload);
    return () => {
      clearInterval(timer);
      window.removeEventListener('tasknest:sync', reload);
    };
  }, [user, signature]);
  return (task: { id: string; projectId?: string }) =>
    task.projectId && user
      ? (states.get(keyFor(user, task.projectId, task.id))?.data?.tags ?? [])
      : [];
}
export function organizationSnapshot(
  user: string,
  project: string,
  task: string,
) {
  return states.get(keyFor(user, project, task));
}
