import { isAccountEmail, isAccountPassword } from './credential-policy';
import type { RegisterErrors, RegisterValues } from './register.types';

export function normalizeRegistration(values: RegisterValues): RegisterValues {
  return {
    ...values,
    fullName: values.fullName.trim(),
    email: values.email.trim().toLowerCase(),
  };
}

export function validateRegistration(values: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = {};
  const { fullName, email } = normalizeRegistration(values);
  const nameLength = Array.from(fullName).length;
  if (nameLength < 2 || nameLength > 100)
    errors.fullName = 'Họ và tên cần có từ 2 đến 100 ký tự.';
  if (!isAccountEmail(email))
    errors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
  if (!isAccountPassword(values.password))
    errors.password = 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.';
  if (!values.confirmPassword)
    errors.confirmPassword = 'Vui lòng nhập lại mật khẩu.';
  else if (values.password !== values.confirmPassword)
    errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
  if (
    values.accountPurpose &&
    !['UNDECIDED', 'CLIENT', 'DEVELOPER', 'BOTH'].includes(
      values.accountPurpose,
    )
  )
    errors.accountPurpose = 'Chọn mục đích sử dụng hợp lệ.';
  return errors;
}
