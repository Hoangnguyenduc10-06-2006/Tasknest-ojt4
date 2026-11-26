import { useEffect, useState } from 'react';

type State<T> = { key: string; brief?: T; loading: boolean; error: string };
export function useAutomaticBrief<T>(userId: string | undefined, scopeKey: string, loader: (userId: string, scopeKey: string) => Promise<T>) {
  const key = JSON.stringify([userId, scopeKey]);
  const [state, setState] = useState<State<T>>({ key: '', loading: false, error: '' });
  useEffect(() => {
    if (!userId || !scopeKey) return;
    const activeUserId = userId;
    let active = true;
    let pending = false;
    let lastAttempt = 0;
    async function analyze() {
      if (!active || pending || document.hidden || Date.now() - lastAttempt < 300000) return;
      pending = true; lastAttempt = Date.now(); setState(current => ({ key, brief: current.key === key ? current.brief : undefined, loading: true, error: '' }));
      try {
        const next = await loader(activeUserId, scopeKey);
        if (active) setState({ key, brief: next, loading: false, error: '' });
      } catch (cause) {
        if (active) {
          setState({ key, loading: false, error: cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'AI phản hồi chậm. Hệ thống sẽ tự kiểm tra lại sau.' });
        }
      } finally { pending = false; if (active) setState(current => current.key === key ? { ...current, loading: false } : current); }
    }
    // Debounce workspace changes; StrictMode cleanup cancels the first scheduled request.
    const initial = window.setTimeout(() => void analyze(), 1000);
    const interval = window.setInterval(() => void analyze(), 300000);
    const onVisible = () => { void analyze(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      active = false;
      window.clearTimeout(initial); window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [userId, scopeKey, key, loader]);
  return scopeKey && state.key === key ? state : { key, brief: undefined, loading: Boolean(scopeKey), error: '' };
}
