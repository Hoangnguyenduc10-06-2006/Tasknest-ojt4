import { describe, expect, it } from 'vitest';
import { hasPurpose, togglePurpose } from './account-purpose';
describe('independent account needs', () => {
  it('allows hiring and development together without choosing a fixed account role', () => {
    let value = togglePurpose('UNDECIDED', 'DEVELOPER', true);
    expect(value).toBe('DEVELOPER');
    value = togglePurpose(value, 'CLIENT', true);
    expect(value).toBe('BOTH');
    expect(hasPurpose(value, 'CLIENT')).toBe(true);
    expect(hasPurpose(value, 'DEVELOPER')).toBe(true);
    value = togglePurpose(value, 'DEVELOPER', false);
    expect(value).toBe('CLIENT');
    expect(togglePurpose(value, 'CLIENT', false)).toBe('UNDECIDED');
  });
});
