import { useEffect, useState } from 'react';
import { AuthCardLayout } from '../components/AuthCardLayout';
import { ResendVerification } from '../components/ResendVerification';
import { verifyEmail } from '../api/auth.api';
import { verificationEmailFromState } from '../model/verification';

export function VerifyEmailPage({ onVerified }: { onVerified: () => void }) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [email] = useState(() => verificationEmailFromState(window.history.state));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let active = true;
    void verifyEmail(token).then((result) => {
      if (!active) return;
      // Notify the waiting registration tab too. No token is persisted or broadcast.
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('tasknest-email-verification');
        channel.postMessage({ type: 'email-verified', email: result.data.email }); channel.close();
      }
      onVerified();
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : 'Không thể xác minh email. Vui lòng thử lại sau.');
    });
    return () => { active = false; };
  }, [token, onVerified]);

  useEffect(() => {
    if (token || !email || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('tasknest-email-verification');
    channel.onmessage = (event) => {
      if (event.data?.type === 'email-verified' && event.data.email === email) onVerified();
    };
    return () => channel.close();
  }, [token, email, onVerified]);

  const verifying = Boolean(token) && !error;
  return <AuthCardLayout>
    <div className="text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-tint text-accent">
        {verifying ? <span aria-hidden="true" className="size-7 animate-spin rounded-full border-2 border-accent/20 border-t-accent motion-reduce:animate-none" />
          : <svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>}
      </span>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">{error ? 'Không thể xác minh email' : verifying ? 'Đang xác minh email' : 'Kiểm tra email của bạn'}</h1>
      {verifying ? <p role="status" className="mt-4 text-sm leading-6 text-muted">Vui lòng chờ. Bạn sẽ được chuyển đến trang đăng nhập sau khi xác minh thành công.</p>
        : error ? <p role="alert" className="mt-4 text-sm leading-6 text-danger">{error}</p>
          : <p className="mt-4 text-sm leading-6 text-muted">Mở liên kết xác nhận trong email{email && <> gửi đến <strong className="break-all font-semibold text-ink">{email}</strong></>} để hoàn tất đăng ký.</p>}
    </div>
    {!verifying && email && <div className="mt-7 space-y-4 border-t border-line pt-5">
      <p className="text-center text-sm text-muted">Chưa nhận được email? Hãy kiểm tra thư rác hoặc yêu cầu gửi lại.</p>
      <ResendVerification email={email} />
    </div>}
    {!verifying && (error || !email) && <a href="/login" className="mt-6 block text-center text-sm font-semibold text-accent hover:underline">Về trang đăng nhập</a>}
  </AuthCardLayout>;
}
