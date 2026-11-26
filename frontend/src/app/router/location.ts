import { withNavigationArea } from './routes';

export function areaHref(path: string | URL) {
  const current = new URL(window.location.href);
  const url = new URL(path, current);
  if (url.origin !== current.origin) return url.href;
  const target = withNavigationArea(url, current);
  return target.pathname + target.search + target.hash;
}

// Native links navigate normally; these events also cover history traversal
// and documents restored from the browser's back/forward cache.
export function subscribeToLocation(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener('pageshow', onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('pageshow', onChange);
  };
}

export function getPathname() {
  return window.location.pathname;
}

// Internal navigation keeps the app shell and shared timer mounted.
export function navigateTo(path: string | URL, state: Record<string, unknown> | null = null) {
  window.history.pushState(state, '', areaHref(path));
  window.dispatchEvent(new Event('popstate'));
  window.scrollTo(0, 0);
}

export function replaceTo(path: string, state: Record<string, unknown> | null = null) {
  window.history.replaceState(state, '', areaHref(path));
  window.dispatchEvent(new Event('popstate'));
  window.scrollTo(0, 0);
}
