import { AuthHeading } from '../components/AuthHeading';
import { AuthCardLayout } from '../components/AuthCardLayout';
import { RegisterForm } from '../components/RegisterForm';
import type { RegisterHandler } from '../model/register.types';

export function RegisterPage({ register, onRegistered }: { register: RegisterHandler; onRegistered: (email: string) => void }) {
  return (
    <AuthCardLayout>
      <AuthHeading title="Tạo tài khoản" eyebrow="Bắt đầu cùng TaskNest" description="Kết nối khách hàng, đội phát triển và cùng triển khai dự án." />
      <RegisterForm register={register} onRegistered={onRegistered} />
      <p className="mt-6 text-center text-sm text-muted">Đã có tài khoản? <a href="/login" className="font-semibold text-accent hover:underline">Đăng nhập</a></p>
      <p className="mt-5 text-center text-xs leading-5 text-muted">
        Cùng TaskNest tổ chức công việc và cộng tác hiệu quả hơn.
      </p>
    </AuthCardLayout>
  );
}
