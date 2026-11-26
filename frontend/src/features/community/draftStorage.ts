const changedEvent = 'tasknest:draft-changed';
export const requestDraftStorageKey = (user: string) =>
  `tasknest:project-request-draft:${user}`;
export const composerDraftStorageKey = (user: string, scope: string) =>
  `tasknest:composer:${user}:${scope}`;
export function readStoredDraft(key: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
export function writeStoredDraft(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(changedEvent));
}
export function removeStoredDraft(key: string) {
  localStorage.removeItem(key);
  window.dispatchEvent(new Event(changedEvent));
}
export function subscribeDrafts(listener: () => void) {
  window.addEventListener(changedEvent, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(changedEvent, listener);
    window.removeEventListener('storage', listener);
  };
}
