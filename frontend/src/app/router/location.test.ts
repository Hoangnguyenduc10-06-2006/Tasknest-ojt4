import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPathname, navigateTo, subscribeToLocation } from './location';

afterEach(() => vi.unstubAllGlobals());

function browserAt(pathname: string) {
  const browser = Object.assign(new EventTarget(), { location: { pathname, search: '', href: 'http://localhost' + pathname, origin: 'http://localhost' } });
  vi.stubGlobal('window', browser);
  return browser;
}

describe('browser history location', () => {
  it('reports the welcome URL after going back from login', () => {
    const browser = browserAt('/login');
    const paths: string[] = [];
    const unsubscribe = subscribeToLocation(() => paths.push(getPathname()));
    browser.location.pathname = '/';
    browser.dispatchEvent(new Event('popstate'));
    expect(paths).toEqual(['/']);
    unsubscribe();
  });

  it('reports the restored URL on pageshow and the forward URL on popstate', () => {
    const browser = browserAt('/register');
    const paths: string[] = [];
    const unsubscribe = subscribeToLocation(() => paths.push(getPathname()));
    browser.location.pathname = '/';
    browser.dispatchEvent(new Event('pageshow'));
    browser.location.pathname = '/login';
    browser.dispatchEvent(new Event('popstate'));
    expect(paths).toEqual(['/', '/login']);
    unsubscribe();
  });

  it('removes both listeners when the app unmounts', () => {
    const browser = browserAt('/');
    const onChange = vi.fn();
    const unsubscribe = subscribeToLocation(onChange);
    unsubscribe();
    browser.dispatchEvent(new Event('popstate'));
    browser.dispatchEvent(new Event('pageshow'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

it('notifies the router on client navigation and preserves query parameters in history', () => {
  const browser = browserAt('/dashboard');
  const pushState = vi.fn((_state, _title, path: string) => {
    const next = new URL(path, 'http://localhost');
    browser.location.pathname = next.pathname;
    browser.location.search = next.search;
    browser.location.href = next.href;
  });
  Object.assign(browser, { history: { pushState }, scrollTo: vi.fn() });
  const paths: string[] = [];
  const unsubscribe = subscribeToLocation(() => paths.push(getPathname()));
  navigateTo('/my-tasks?filter=overdue');
  expect(pushState).toHaveBeenCalledWith(null, '', '/my-tasks?filter=overdue');
  expect(paths).toEqual(['/my-tasks']);
  unsubscribe();
});
