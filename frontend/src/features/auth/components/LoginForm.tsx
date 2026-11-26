import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { PasswordField } from '../../../shared/ui/PasswordField';
import { TextField } from '../../../shared/ui/TextField';
import { ApiError } from '../../../shared/api/client';
import { isAccountEmail, isAccountPassword } from '../model/credential-policy';
import { login } from '../api/auth.api';

export function LoginForm({ onSuccess, onVerificationRequired }: { onSuccess: () => void; onVerificationRequired: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [unverified, setUnverified] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!isAccountEmail(email)) { setMessage('Vui lòng nhập địa chỉ email hợp lệ.'); return; }
    if (!isAccountPassword(password)) { setMessage('Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.'); return; }
    busy.current = true; setPending(true); setMessage(''); setUnverified(false);
    try { await login(email, password); setPassword(''); onSuccess(); }
    catch (error) {
      setMessage(error instanceof Error ? error.message : 'Chưa thể đăng nhập. Vui lòng thử lại.');
      setUnverified(error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED');
    } finally { busy.current = false; setPending(false); }
  }
  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-5">
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">Thông tin đăng nhập</legend>
        <TextField label="Email" name="email" type="email" placeholder="ban@example.com" autoComplete="username" required maxLength={255} value={email} onChange={(event) => { setEmail(event.target.value); setMessage(''); setUnverified(false); }} />
        <PasswordField label="Mật khẩu" name="password" placeholder="Nhập mật khẩu" autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setMessage(''); }} />
      </fieldset>
      <div className="text-right"><a href="/forgot-password" className="text-xs font-medium text-accent hover:underline">Quên mật khẩu?</a></div>
      {message && <p role="alert" className="text-sm text-danger">{message}</p>}
      <Button type="submit" loading={pending} className="w-full">Đăng nhập</Button>
      {unverified && <Button className="w-full" onClick={() => onVerificationRequired(email)}>Mở trang xác minh email</Button>}
      <p className="text-center text-sm text-muted">Chưa có tài khoản? <a href="/register" className="font-semibold text-accent hover:underline">Đăng ký miễn phí</a></p>
    </form>
  );
}
