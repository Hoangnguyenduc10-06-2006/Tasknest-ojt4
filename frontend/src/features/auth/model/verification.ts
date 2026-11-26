import { isAccountEmail } from './credential-policy';

export function normalizeVerificationEmail(value: string) {
  return value.trim().toLowerCase();
}
export function isVerificationEmail(value: string) {
  return isAccountEmail(value);
}
export function verificationEmailFromState(state: unknown) {
  if (!state || typeof state !== 'object' || !('verificationEmail' in state) || typeof state.verificationEmail !== 'string') return '';
  const email = normalizeVerificationEmail(state.verificationEmail);
  return isVerificationEmail(email) ? email : '';
}
