import { describe, expect, it } from 'vitest';
import { isVerificationEmail, verificationEmailFromState } from './verification';

describe('verification navigation context', () => {
  it('keeps only a valid normalized email from registration history state', () => {
    expect(verificationEmailFromState({ verificationEmail: ' User@Example.com ', password: 'not-used' })).toBe('user@example.com');
    for (const value of [null, 'user@example.com', {}, { verificationEmail: {} }, { verificationEmail: 'invalid' }]) expect(verificationEmailFromState(value)).toBe('');
  });
  it('rejects missing, malformed and oversized resend recipients', () => {
    for (const value of ['', 'bad', 'a b@example.com', 'a'.repeat(250) + '@example.com']) expect(isVerificationEmail(value)).toBe(false);
    expect(isVerificationEmail('user+test@example.com')).toBe(true);
  });
});
