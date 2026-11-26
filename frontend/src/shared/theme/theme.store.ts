export type Theme = 'light' | 'dark' | 'system';
function readTheme(): Theme {
  try {
    const value = localStorage.getItem('tasknest-theme');
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch { /* Storage may be unavailable. */ }
  return 'system';
}
let theme = readTheme();
const listeners = new Set<() => void>();
export const getTheme = () => theme;
export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setTheme(next: Theme) {
  if (theme === next) return;
  theme = next;
  try { localStorage.setItem('tasknest-theme', next); } catch { /* Keep the choice in memory. */ }
  listeners.forEach((listener) => listener());
}
