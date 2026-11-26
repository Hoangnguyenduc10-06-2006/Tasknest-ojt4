import { isAccountPassword } from '../model/credential-policy';
import { AuthHeading } from '../components/AuthHeading';
import { useRef, useState, type FormEvent } from 'react';
import { AuthCardLayout } from '../components/AuthCardLayout';
import { PasswordField } from '../../../shared/ui/PasswordField';
import { Button } from '../../../shared/ui/Button';
import { resetPassword } from '../api/account-security.api';
export function ResetPasswordPage() {
  const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
  const [error,setError]=useState('');const [pending,setPending]=useState(false);const [done,setDone]=useState(false);const busy=useRef(false);
  const token=new URLSearchParams(window.location.search).get('token')??'';
  async function submit(event:FormEvent) {
    event.preventDefault();if(busy.current)return;
    if(!isAccountPassword(password) || password!==confirm){setError('Mật khẩu cần ít nhất 8 ký tự, tối đa 72 byte và xác nhận phải khớp.');return;}
    busy.current=true;setPending(true);setError('');
    try { await resetPassword(token,password,confirm);setPassword('');setConfirm('');window.history.replaceState(null,'','/reset-password');setDone(true); }
    catch(error){setError(error instanceof Error?error.message:'Không thể đặt lại mật khẩu.');}
    finally{busy.current=false;setPending(false);}
  }
  return <AuthCardLayout><AuthHeading title="Đặt lại mật khẩu" eyebrow="Bảo mật tài khoản" icon="check" />{done?<div role="status" className="mt-6 space-y-4"><p>Đã đặt lại mật khẩu và đăng xuất các thiết bị.</p><a className="text-accent" href="/login">Đăng nhập</a></div>:<form onSubmit={submit} className="mt-7 space-y-5"><p className="text-sm text-muted">Liên kết có hiệu lực 15 phút và chỉ dùng một lần.</p><PasswordField label="Mật khẩu mới" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required/><PasswordField label="Xác nhận mật khẩu" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}<Button type="submit" disabled={pending||!token} className="w-full">Lưu mật khẩu mới</Button><a className="block text-sm text-accent" href="/forgot-password">Yêu cầu liên kết mới</a></form>}</AuthCardLayout>;
}
