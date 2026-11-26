import { useEffect, useSyncExternalStore } from 'react';
import { getTheme, setTheme, subscribeTheme } from './theme.store';
export type { Theme } from './theme.store';

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return { theme, setTheme };
}
