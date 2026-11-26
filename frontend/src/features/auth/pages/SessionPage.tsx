import { useState } from 'react';
import { checkSession } from '../api/auth.api';
import { useSession } from '../hooks/useSession';
import { LogoutButton } from '../components/LogoutButton';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Panel } from '../../../shared/ui/Panel';
import { Button } from '../../../shared/ui/Button';

export function SessionPage() {
  const session = useSession();
  const [pending, setPending] = useState(false);
  async function recheck() { setPending(true); try { await checkSession(); } finally { setPending(false); } }
  return <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-ink"><Panel className="w-full max-w-lg space-y-5">
    <PageHeader eyebrow="TÀI KHOẢN" title="Phiên đăng nhập" description="Kiểm tra trạng thái đăng nhập trên thiết bị này." />
    {session.status === 'authenticated' && <p>{session.user.fullName} · {session.user.email}</p>}
    <Button loading={pending} onClick={() => void recheck()}>Kiểm tra phiên</Button>
    <LogoutButton />
    <a href="/dashboard" className="block text-accent">Đến dashboard</a>
  </Panel></main>;
}
