import { useEffect } from 'react';
import { navigateTo } from './location';

// Temporary SPA navigation for native internal links; preserve modified/external clicks.
// Kept in app so features/shared never depend on the application router.
export function useClientNavigation() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a') : null;
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('data-native-navigation')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.hash || /^\/(api|ws)(\/|$)/.test(url.pathname)) return;
      event.preventDefault();
      navigateTo(url);
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}
