import { useState, useRef, type FormEvent } from 'react';
import { AccountPurposePicker } from '../../../shared/ui/AccountPurposePicker';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { PasswordField } from '../../../shared/ui/PasswordField';
import { useRegisterForm } from '../hooks/useRegisterForm';
import type { RegisterHandler } from '../model/register.types';

export function RegisterForm({
  register,
  onRegistered,
}: {
  register: RegisterHandler;
  onRegistered: (email: string) => void;
}) {
  const { values, errors, pending, submitError, updateField, submit } =
    useRegisterForm(register, onRegistered);
  const [step, setStep] = useState<'purpose' | 'account'>('purpose');
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstInvalid = await submit();
    if (firstInvalid)
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)
        ?.focus();
  }

  if (step === 'purpose')
    return (
      <div className="space-y-5">
        <AccountPurposePicker
          value={values.accountPurpose ?? 'UNDECIDED'}
          onChange={(value) => updateField('accountPurpose', value)}
        />
        <Button
          className="w-full"
          disabled={
            !values.accountPurpose || values.accountPurpose === 'UNDECIDED'
          }
          onClick={() => setStep('account')}
        >
          Tiếp tục tạo tài khoản
        </Button>
      </div>
    );
  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
    >
      <Button
        kind="ghost"
        size="sm"
        disabled={pending}
        onClick={() => setStep('purpose')}
      >
        ← Thay đổi nhu cầu sử dụng
      </Button>
      <fieldset disabled={pending} className="space-y-5">
        <legend className="sr-only">Thông tin tạo tài khoản</legend>
        <TextField
          label="Họ và tên"
          name="fullName"
          autoComplete="name"
          placeholder="Nguyễn Văn An"
          required
          maxLength={100}
          value={values.fullName}
          error={errors.fullName}
          onChange={(event) => updateField('fullName', event.target.value)}
        />
        <TextField
          label="Địa chỉ email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ban@example.com"
          required
          maxLength={255}
          spellCheck={false}
          autoCapitalize="none"
          value={values.email}
          error={errors.email}
          onChange={(event) => updateField('email', event.target.value)}
        />
        <PasswordField
          label="Mật khẩu"
          name="password"
          autoComplete="new-password"
          placeholder="Nhập mật khẩu của bạn"
          required
          hint="Ít nhất 8 ký tự, tối đa 72 byte UTF-8."
          value={values.password}
          error={errors.password}
          onChange={(event) => updateField('password', event.target.value)}
        />
        <PasswordField
          label="Xác nhận mật khẩu"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          required
          value={values.confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) =>
            updateField('confirmPassword', event.target.value)
          }
        />
      </fieldset>
      {submitError && (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger"
        >
          {submitError}
        </p>
      )}
      <Button type="submit" loading={pending} className="w-full">
        {pending ? 'Đang xử lý…' : 'Tạo tài khoản'}
        <span aria-hidden="true">→</span>
      </Button>
    </form>
  );
}
