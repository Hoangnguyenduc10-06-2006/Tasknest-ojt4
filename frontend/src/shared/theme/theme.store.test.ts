import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
it('shares theme changes between independent controls and tolerates blocked storage', async () => {
  vi.resetModules();
  vi.stubGlobal('localStorage', { getItem: () => 'dark', setItem: () => { throw new Error('Blocked'); } });
  const { getTheme, setTheme, subscribeTheme } = await import('./theme.store');
  const navbar = vi.fn(() => getTheme()); const profile = vi.fn(() => getTheme());
  const removeNavbar = subscribeTheme(navbar); const removeProfile = subscribeTheme(profile);
  expect(getTheme()).toBe('dark');
  setTheme('light');
  expect(navbar).toHaveReturnedWith('light'); expect(profile).toHaveReturnedWith('light');
  removeProfile(); setTheme('system');
  expect(navbar).toHaveReturnedWith('system'); expect(profile).toHaveBeenCalledTimes(1);
  removeNavbar();
});
