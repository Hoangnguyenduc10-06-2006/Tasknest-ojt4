import { useEffect, useRef, useState } from 'react';
import type {
  RegisterErrors,
  RegisterHandler,
  RegisterValues,
} from '../model/register.types';
import {
  normalizeRegistration,
  validateRegistration,
} from '../model/register.validation';

const emptyValues: RegisterValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  accountPurpose: 'UNDECIDED',
};

export function useRegisterForm(
  register: RegisterHandler,
  onRegistered: (email: string) => void,
) {
  const [values, setValues] = useState<RegisterValues>(emptyValues);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function updateField(field: keyof RegisterValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'password' ? { confirmPassword: undefined } : {}),
    }));
    setSubmitError('');
  }

  async function submit(): Promise<keyof RegisterValues | undefined> {
    if (busy.current) return;
    const validation = validateRegistration(values);
    setErrors(validation);
    const firstInvalid = (
      Object.keys(validation) as (keyof RegisterValues)[]
    )[0];
    if (firstInvalid) return firstInvalid;
    busy.current = true;
    setPending(true);
    setSubmitError('');
    try {
      const input = normalizeRegistration(values);
      await register(input);
      if (mounted.current) {
        setValues((current) => ({
          ...current,
          password: '',
          confirmPassword: '',
          accountPurpose: 'UNDECIDED',
        }));
        onRegistered(input.email);
      }
    } catch (error) {
      if (mounted.current)
        setSubmitError(
          error instanceof Error
            ? error.message
            : 'Chưa thể gửi đăng ký. Vui lòng thử lại sau.',
        );
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return { values, errors, pending, submitError, updateField, submit };
}
