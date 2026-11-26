import { useSyncExternalStore } from 'react';
import { subscribeToLocation } from './location';

export function usePathname() {
  const location = useSyncExternalStore(subscribeToLocation, () => window.location.pathname + window.location.search);
  return location.split('?')[0];
}
