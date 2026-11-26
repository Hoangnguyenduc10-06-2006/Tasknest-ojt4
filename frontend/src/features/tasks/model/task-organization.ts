import { useSyncExternalStore } from 'react';

export type TaskTagPreset = {
  id: string;
  label: string;
  tone: 'red' | 'amber' | 'green' | 'blue' | 'purple' | 'neutral';
};

export const TASK_TAG_PRESETS: TaskTagPreset[] = [
  { id: 'BUG', label: 'Bug / Lỗi', tone: 'red' },
  { id: 'BACKEND', label: 'Backend / API', tone: 'purple' },
  { id: 'FRONTEND', label: 'Giao diện UI', tone: 'blue' },
  { id: 'FEATURE', label: 'Tính năng mới', tone: 'green' },
  { id: 'HOTFIX', label: 'Cần gấp', tone: 'amber' },
];

const PINS_PREFIX = 'tasknest:pinned-tasks:';
const listeners = new Set<() => void>();
const pinsCache = new Map<string, string[]>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeTaskOrganization(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTagMeta(tagId: string): TaskTagPreset {
  return (
    TASK_TAG_PRESETS.find((preset) => preset.id === tagId) ?? {
      id: tagId,
      label: tagId,
      tone: 'neutral',
    }
  );
}

export function getPinnedTaskIds(userId = 'default'): string[] {
  const key = userId || 'default';
  const cached = pinsCache.get(key);
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(PINS_PREFIX + key);
    if (!raw) {
      const empty: string[] = [];
      pinsCache.set(key, empty);
      return empty;
    }
    const parsed = JSON.parse(raw) as unknown;
    const normalized = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
    pinsCache.set(key, normalized);
    return normalized;
  } catch {
    const empty: string[] = [];
    pinsCache.set(key, empty);
    return empty;
  }
}

export function isTaskPinned(taskId: string, userId = 'default'): boolean {
  return getPinnedTaskIds(userId).includes(String(taskId));
}

export function toggleTaskPin(taskId: string, userId = 'default'): boolean {
  const key = userId || 'default';
  const id = String(taskId);
  const current = getPinnedTaskIds(key);
  const pinned = current.includes(id);
  const next = pinned ? current.filter((item) => item !== id) : [...current, id];
  pinsCache.set(key, next);
  try {
    window.localStorage.setItem(PINS_PREFIX + key, JSON.stringify(next));
  } catch {
    // Keep in-memory state
  }
  emit();
  return !pinned;
}

export function usePinnedTasks(userId = 'default') {
  return useSyncExternalStore(
    subscribeTaskOrganization,
    () => getPinnedTaskIds(userId),
    () => []
  );
}
