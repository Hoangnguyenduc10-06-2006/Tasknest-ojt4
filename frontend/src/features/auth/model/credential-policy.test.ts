import { describe, expect, it } from 'vitest';
import { isAccountEmail, isAccountPassword } from './credential-policy';
describe('account credential policy', () => {
  it('rejects an email that cannot be used to log in', () => {
    expect(isAccountEmail(' USER+tag@Example.com ')).toBe(true);
    expect(isAccountEmail('a'.repeat(64) + '@example.test')).toBe(true);
    expect(isAccountEmail('a'.repeat(65) + '@example.test')).toBe(false);
    expect(isAccountEmail('a..b@example.test')).toBe(false);
  });
  it('enforces the BCrypt limit in UTF-8 bytes', () => {
    expect(isAccountPassword('a'.repeat(72))).toBe(true);
    expect(isAccountPassword('a'.repeat(73))).toBe(false);
    expect(isAccountPassword('ậ'.repeat(24))).toBe(true);
    expect(isAccountPassword('ậ'.repeat(25))).toBe(false);
    expect(isAccountPassword('😀'.repeat(4))).toBe(false);
  });
});
