import { describe, expect, it } from 'vitest';
import { validationMessageFor } from './inline-form-validation';

const valid = {
  valueMissing: false,
  typeMismatch: false,
  patternMismatch: false,
  tooShort: false,
  tooLong: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  stepMismatch: false,
  badInput: false,
  customError: false,
};

describe('inline form validation messages', () => {
  it('shows a field-level required message', () => {
    expect(validationMessageFor('Tên nhiệm vụ', 'text', { ...valid, valueMissing: true }))
      .toBe('Tên nhiệm vụ không được để trống.');
  });

  it('localizes common input format and length errors', () => {
    expect(validationMessageFor('Email', 'email', { ...valid, typeMismatch: true }))
      .toBe('Email không đúng định dạng email.');
    expect(validationMessageFor('Mật khẩu', 'password', { ...valid, tooShort: true }, { minLength: 8 }))
      .toBe('Mật khẩu cần có ít nhất 8 ký tự.');
  });

  it('shows range limits beneath the invalid field', () => {
    expect(validationMessageFor('Ngân sách', 'number', { ...valid, rangeUnderflow: true }, { min: '1000000' }))
      .toBe('Ngân sách phải từ 1000000 trở lên.');
  });
});
