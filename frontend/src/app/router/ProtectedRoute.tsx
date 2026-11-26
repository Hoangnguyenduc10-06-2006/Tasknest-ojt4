import { useEffect, type ReactNode } from 'react';
import { checkSession, forgetSession, useSession } from '../../features/auth';
import { replaceTo } from './location';

export function ProtectedRoute({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const session = useSession();
  useEffect(() => {
    void checkSession();
    const recheck = () => {
      void checkSession();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') recheck();
    };
    window.addEventListener('focus', recheck);
    window.addEventListener('pageshow', recheck);
    document.addEventListener('visibilitychange', visible);
    const poll = window.setInterval(recheck, 60000);
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('tasknest-session')
        : null;
    if (channel)
      channel.onmessage = (event) => {
        if (event.data === 'logout') forgetSession();
      };
    return () => {
      window.removeEventListener('focus', recheck);
      window.removeEventListener('pageshow', recheck);
      document.removeEventListener('visibilitychange', visible);
      window.clearInterval(poll);
      channel?.close();
    };
  }, [pathname]);
  useEffect(() => {
    if (session.status !== 'authenticated') return;
    const timer = window.setTimeout(
      () => {
        void checkSession();
      },
      Math.max(1, session.refreshAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session]);
  useEffect(() => {
    if (session.status === 'guest') {
      const destination = window.location.pathname + window.location.search;
      if (/^\/join\/[0-9a-f]{64}$/.test(window.location.pathname)) {
        try {
          sessionStorage.setItem(
            'tasknest.pendingJoin',
            window.location.pathname,
          );
        } catch {
          /* Browser storage may be disabled. */
        }
      }
      replaceTo('/login?returnTo=' + encodeURIComponent(destination));
    }
  }, [session.status, pathname]);
  if (session.status === 'authenticated') return children;
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-ink">
      <section
        role="status"
        className="max-w-md space-y-4 rounded-2xl border border-line bg-surface p-8 text-center"
      >
        <p>
          {session.status === 'error'
            ? session.message
            : 'Đang kiểm tra phiên đăng nhập…'}
        </p>
        {session.status === 'error' && (
          <button
            onClick={() => void checkSession()}
            className="rounded-xl bg-accent px-5 py-3 text-on-accent"
          >
            Thử lại
          </button>
        )}
      </section>
    </main>
  );
}
