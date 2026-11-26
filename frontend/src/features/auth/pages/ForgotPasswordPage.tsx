import { AuthHeading } from '../components/AuthHeading';
import { AuthCardLayout } from '../components/AuthCardLayout';
import { ForgotPasswordForm } from '../components/ForgotPasswordForm';

export function ForgotPasswordPage() {
  return (
    <AuthCardLayout>
      <AuthHeading title="Quên mật khẩu?" eyebrow="Khôi phục tài khoản" description="Nhập email của bạn để nhận hướng dẫn đặt lại mật khẩu." icon="inbox" />
      <ForgotPasswordForm />
    </AuthCardLayout>
  );
}
