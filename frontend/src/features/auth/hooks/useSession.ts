import { useSyncExternalStore } from 'react';
import { getSessionSnapshot, subscribeSession } from '../model/session.store';

export function useSession() {
  return useSyncExternalStore(subscribeSession, getSessionSnapshot);
}
