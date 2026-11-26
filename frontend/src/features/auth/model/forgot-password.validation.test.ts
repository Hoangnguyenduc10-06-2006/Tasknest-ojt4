import { expect, it } from 'vitest';
import { normalizeForgotPasswordEmail, validateForgotPasswordEmail } from './forgot-password.validation';
it('normalizes recovery emails consistently with login and registration', () => {
  expect(normalizeForgotPasswordEmail(' USER+tag@Example.com ')).toBe('user+tag@example.com');
  expect(validateForgotPasswordEmail(' USER+tag@Example.com ')).toBeUndefined();
});
it('rejects malformed or unsupported recovery emails before showing a valid form', () => {
  for (const email of ['', 'a..b@example.com', 'a'.repeat(65) + '@example.com', 'user@-example.com']) {
    expect(validateForgotPasswordEmail(email)).toBeDefined();
  }
});
