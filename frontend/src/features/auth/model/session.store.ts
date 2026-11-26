export type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  emailVerified: boolean;
  jobTitle?: string;
  bio?: string;
  version?: number;
  hasAvatar?: boolean;
  accountPurpose?: string;
  onboardingStatus?: string;
  onboardingStep?: number;
  avatarPublic?: boolean;
};
export type SessionSnapshot =
  | { status: 'checking' | 'guest' }
  | {
      status: 'authenticated';
      user: SessionUser;
      expiresAt: number;
      refreshAt: number;
    }
  | { status: 'error'; message: string };
let snapshot: SessionSnapshot = { status: 'checking' };
const listeners = new Set<() => void>();
export const getSessionSnapshot = () => snapshot;
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function publishSession(next: SessionSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}
