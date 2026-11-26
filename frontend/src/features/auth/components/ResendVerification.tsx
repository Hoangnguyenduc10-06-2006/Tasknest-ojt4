import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { resendVerification } from '../api/auth.api';

export function ResendVerification({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function resend() {
    if (pending) return;
    setPending(true); setMessage('');
    try { await resendVerification(email); setMessage('Yêu cầu gửi lại đã được ghi nhận. Vui lòng kiểm tra hộp thư và thư rác.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Chưa thể gửi lại email.'); }
    finally { setPending(false); }
  }
  return <div className="space-y-2 text-center">
    <Button size="sm" loading={pending} onClick={() => void resend()}>Gửi lại email xác nhận</Button>
    {message && <p role="status" className="text-sm text-muted">{message}</p>}
  </div>;
}
