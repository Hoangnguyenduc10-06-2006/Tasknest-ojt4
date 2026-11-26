import { useRef, useState } from 'react';
import { logout } from '../api/auth.api';

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  async function signOut() {
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage('');
    try { await logout(); }
    catch { setMessage('Chưa thể đăng xuất. Vui lòng thử lại.'); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="relative shrink-0">
    <button type="button" disabled={pending} onClick={() => void signOut()} className="rounded-xl border border-line px-2.5 py-2 text-xs font-semibold text-muted hover:bg-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 sm:px-3 sm:text-sm">{pending ? 'Đang thoát…' : 'Đăng xuất'}</button>
    {message && <p role="alert" className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-line bg-surface p-3 text-sm text-danger">{message}</p>}
  </div>;
}
