import { AuthHeading } from '../components/AuthHeading';
import { AuthCardLayout } from '../components/AuthCardLayout';
import { LoginForm } from '../components/LoginForm';

export function LoginPage({ onSuccess, onVerificationRequired, emailVerified = false }: { emailVerified?: boolean; onSuccess: () => void; onVerificationRequired: (email: string) => void }) {
  return (
    <AuthCardLayout>
      <AuthHeading title="Đăng nhập vào TaskNest" eyebrow="Chào mừng trở lại" description="Tiếp tục công việc cùng nhóm của bạn." brand />
      {emailVerified && <p role="status" className="mt-6 rounded-xl bg-tint p-4 text-center text-sm text-accent">Email đã được xác minh. Bạn có thể đăng nhập.</p>}
      <LoginForm onSuccess={onSuccess} onVerificationRequired={onVerificationRequired} />
    </AuthCardLayout>
  );
}
