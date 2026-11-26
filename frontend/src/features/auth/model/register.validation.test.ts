import { describe, expect, it } from 'vitest';
import {
  normalizeRegistration,
  validateRegistration,
} from './register.validation';
import type { RegisterValues } from './register.types';

const valid: RegisterValues = {
  fullName: 'Đặng Khánh An',
  email: 'an@example.com',
  password: 'abcdefgh',
  confirmPassword: 'abcdefgh',
};

describe('registration rules', () => {
  it('accepts purpose choices without turning them into authorization roles', () => {
    for (const accountPurpose of ['CLIENT', 'DEVELOPER', 'BOTH', 'UNDECIDED'])
      expect(validateRegistration({ ...valid, accountPurpose })).toEqual({});
    expect(
      validateRegistration({ ...valid, accountPurpose: 'ADMIN' })
        .accountPurpose,
    ).toBeDefined();
  });
  it('accepts Vietnamese names and an eight-character password', () => {
    expect(validateRegistration(valid)).toEqual({});
  });
  it('checks name boundaries after trimming', () => {
    for (const fullName of ['   ', ' A ', 'a'.repeat(101)]) {
      expect(
        validateRegistration({ ...valid, fullName }).fullName,
      ).toBeDefined();
    }
    expect(
      validateRegistration({ ...valid, fullName: 'a'.repeat(100) }).fullName,
    ).toBeUndefined();
  });
  it('rejects malformed emails', () => {
    for (const email of ['', 'an@', 'a b@example.com', 'a@@example.com']) {
      expect(validateRegistration({ ...valid, email }).email).toBeDefined();
    }
  });
  it('rejects short passwords and mismatched confirmation', () => {
    expect(
      validateRegistration({ ...valid, password: 'short' }).password,
    ).toBeDefined();
    expect(
      validateRegistration({ ...valid, confirmPassword: 'different' })
        .confirmPassword,
    ).toBeDefined();
  });
  it('normalizes name/email without changing passwords or mutating the form', () => {
    const input = {
      ...valid,
      fullName: '  Đặng Khánh An  ',
      email: ' AN@Example.COM ',
      password: ' passWord ',
      confirmPassword: ' passWord ',
    };
    const result = normalizeRegistration(input);
    expect(result).toEqual({
      fullName: 'Đặng Khánh An',
      email: 'an@example.com',
      password: ' passWord ',
      confirmPassword: ' passWord ',
    });
    expect(input.email).toBe(' AN@Example.COM ');
  });
});
