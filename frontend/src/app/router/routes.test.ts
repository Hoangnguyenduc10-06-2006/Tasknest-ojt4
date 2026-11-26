import { describe, expect, it } from 'vitest';
import {
  resolveRoute,
  requiresSession,
  safeReturnTo,
  isPrivateCommunityView,
} from './routes';

describe('route resolution', () => {
  it('allows public team and member profiles and returns there after login', () => {
    for (const path of [
      '/teams',
      '/teams/17',
      '/requests',
      '/requests/42',
      '/members/00000000-0000-4000-8000-000000000001',
    ]) {
      expect(resolveRoute(path).kind).toBe('community');
      expect(requiresSession(path)).toBe(false);
      expect(safeReturnTo(path)).toBe(path);
    }
    expect(resolveRoute('/teams/17/invitations').kind).toBe('not-found');
    expect(requiresSession('/teams/17/invitations')).toBe(true);
  });
  it('keeps welcome separate from unknown URLs', () => {
    expect(resolveRoute('/').kind).toBe('welcome');
    for (const path of [
      '/unknown',
      '/dashboard/unknown',
      '/projects/a/unknown',
      '/toString',
    ]) {
      expect(resolveRoute(path).kind).toBe('not-found');
    }
  });

  it('resolves the protected profile page', () => {
    expect(resolveRoute('/profile')).toEqual({ kind: 'profile' });
  });
  it('resolves and protects the review queue, retaining the personal review filter', () => {
    expect(resolveRoute('/tasks-needing-review')).toEqual({
      kind: 'workspace',
      title: 'Nhiệm vụ cần duyệt',
    });
    expect(requiresSession('/tasks-needing-review')).toBe(true);
    expect(safeReturnTo('/tasks-needing-review')).toBe('/tasks-needing-review');
    expect(safeReturnTo('/my-tasks?status=awaiting_review')).toBe(
      '/my-tasks?status=awaiting_review',
    );
  });
  it('resolves workspace menu and detail URLs explicitly', () => {
    for (const path of [
      '/my-tasks',
      '/my-projects',
      '/my-time',
      '/invitations',
      '/notifications',
      '/tasks/new',
      '/tasks/t1',
      '/projects/p1',
    ]) {
      expect(resolveRoute(path).kind).toBe('workspace');
    }
    expect(resolveRoute('/tasks/new')).toEqual({
      kind: 'workspace',
      title: 'Tạo nhiệm vụ',
    });
  });

  it('resolves completed screens independently', () => {
    expect(resolveRoute('/dashboard').kind).toBe('dashboard');
    expect(resolveRoute('/login').kind).toBe('login');
    expect(resolveRoute('/register').kind).toBe('register');
    expect(resolveRoute('/forgot-password').kind).toBe('forgot-password');
  });
});

describe('protected route policy', () => {
  it('requires authentication for personal discovery views without closing public directories', () => {
    for (const [path, search] of [
      ['/requests', '?view=mine'],
      ['/teams', '?view=mine'],
      ['/teams', '?view=applications'],
    ])
      expect(isPrivateCommunityView(path, search)).toBe(true);
    for (const [path, search] of [
      ['/requests', ''],
      ['/teams', ''],
      ['/teams', '?view=recruiting'],
      ['/teams/12', ''],
    ])
      expect(isPrivateCommunityView(path, search)).toBe(false);
    expect(safeReturnTo('/teams?view=applications')).toBe(
      '/teams?view=applications',
    );
  });

  it('protects every business URL including direct links and future routes', () => {
    for (const path of [
      '/dashboard',
      '/my-tasks',
      '/my-projects',
      '/my-time',
      '/profile',
      '/notifications',
      '/invitations',
      '/projects/p1',
      '/tasks/t1',
      '/tasks/new',
      '/auth/session',
      '/dev/services',
      '/future-route',
      '/projects',
      '/tasks',
      '/my-invitations',
    ]) {
      expect(requiresSession(path), path).toBe(true);
    }
    for (const path of [
      '/',
      '/login',
      '/register',
      '/forgot-password',
      '/verify-email',
    ])
      expect(requiresSession(path)).toBe(false);
  });
  it('returns to valid internal business pages and rejects open redirects/login loops', () => {
    expect(safeReturnTo('/projects/p1?view=board')).toBe(
      '/projects/p1?view=board',
    );
    for (const path of ['/projects', '/tasks', '/my-invitations'])
      expect(safeReturnTo(path)).toBe(path);
    for (const path of [
      null,
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/login',
      '/register',
      '/missing',
      '/dashboard\n',
    ]) {
      expect(safeReturnTo(path)).toBe('/dashboard');
    }
  });
});
