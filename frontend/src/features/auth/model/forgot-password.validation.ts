import { isAccountEmail } from './credential-policy';

export function normalizeForgotPasswordEmail(value: string) {
  return value.trim().toLowerCase();
}
export function validateForgotPasswordEmail(value: string): string | undefined {
  if (!isAccountEmail(value)) return 'Vui lòng nhập địa chỉ email hợp lệ.';
}
