import { useRef, useState, type FormEvent } from 'react';
import { requestPasswordReset } from '../api/account-security.api';
import { Button } from '../../../shared/ui/Button';
import { normalizeForgotPasswordEmail, validateForgotPasswordEmail } from '../model/forgot-password.validation';
import { TextField } from '../../../shared/ui/TextField';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [previewed, setPreviewed] = useState(false);

  const busy=useRef(false);
  const [pending,setPending]=useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeForgotPasswordEmail(email);
    const validationError = validateForgotPasswordEmail(normalized);
    setEmail(normalized); setError(validationError);
    if(validationError || busy.current) return;
    busy.current=true;setPending(true);
    try { await requestPasswordReset(normalized);setPreviewed(true); }
    catch(error) { setError(error instanceof Error?error.message:'Không thể gửi yêu cầu.'); }
    finally { busy.current=false;setPending(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-5">
      <TextField
        label="Địa chỉ email"
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="ban@example.com"
        required
        maxLength={255}
        error={error}
        value={email}
        onChange={(event) => { setEmail(event.target.value); setPreviewed(false); setError(undefined); }}
      />
      <p className="text-sm leading-6 text-muted">Nếu email đã được đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra cả thư mục thư rác.</p>
      <div role="status" aria-live="polite" aria-atomic="true">
        {previewed && <p className="rounded-xl bg-tint px-4 py-3 text-sm leading-6 text-accent">Nếu tài khoản đủ điều kiện, hướng dẫn đặt lại mật khẩu sẽ được gửi qua email. Bạn có thể gửi lại sau 60 giây.</p>}
      </div>
      <Button disabled={pending} type="submit" className="w-full">Gửi hướng dẫn đặt lại<span aria-hidden="true">→</span></Button>
      <p className="text-center"><a href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"><span aria-hidden="true">←</span>Quay lại đăng nhập</a></p>
      <p className="text-center text-xs leading-5 text-muted">
        Lấy lại quyền truy cập để tiếp tục công việc cùng nhóm.
      </p>
    </form>
  );
}
