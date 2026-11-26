import { withNavigationArea } from '../router/routes';
import { describe, expect, it } from 'vitest';
import {
  discoveryNavigation,
  connectionNavigation,
  selectedNavigation,
  navigationArea,
  navigationTitle,
} from './navigation';

describe('shared platform navigation', () => {
  it('keeps public discovery and project execution in their corresponding areas', () => {
    for (const path of [
      '/requests',
      '/requests/12',
      '/teams',
      '/teams/3',
      '/members/00000000-0000-4000-8000-000000000001',
    ])
      expect(navigationArea(path)).toBe('discovery');
    for (const path of ['/dashboard', '/projects/12', '/my-tasks', '/profile'])
      expect(navigationArea(path)).toBe('work');
  });
  it('selects exactly one query-based discovery destination, retaining detail parents', () => {
    const items = [...discoveryNavigation, ...connectionNavigation];
    for (const item of items) {
      const url = new URL(item.href, 'https://tasknest.test');
      const selected = selectedNavigation(url.pathname, url.search);
      expect(items.filter((candidate) => candidate.href === selected)).toEqual([
        item,
      ]);
    }
    expect(selectedNavigation('/teams', '?view=unknown')).toBe('/teams');
    expect(selectedNavigation('/teams/7', '')).toBe('/teams');
    expect(selectedNavigation('/messages', '')).toBe('/messages');
    expect(selectedNavigation('/messages', '?area=discovery')).toBe('/messages?area=discovery');
    expect(connectionNavigation.some(item => item.href === selectedNavigation('/messages', '?area=discovery'))).toBe(false);
    expect(selectedNavigation('/connections', '?area=discovery')).toBe('/connections?area=discovery');
    expect(selectedNavigation('/requests/12', '')).toBe('/requests');
  });
  it('keeps shared destinations in their originating area', () => {
    const discovery = new URL('https://tasknest.test/teams/3');
    const launch = withNavigationArea(new URL('/messages?project=12', discovery), discovery);
    expect(launch.searchParams.get('project')).toBe('12');
    expect(navigationArea(launch.pathname, launch.search)).toBe('discovery');
    const room = withNavigationArea(new URL('/messages?conversation=8', discovery), launch);
    expect(room.searchParams.get('conversation')).toBe('8');
    expect(navigationArea(room.pathname, room.search)).toBe('discovery');
    for (const path of ['/notifications', '/profile']) {
      const shared = withNavigationArea(new URL(path, discovery), room);
      expect(navigationArea(shared.pathname, shared.search)).toBe('discovery');
    }
    const project = withNavigationArea(new URL('/projects/12', discovery), room);
    expect(navigationArea(project.pathname, project.search)).toBe('work');
    expect(withNavigationArea(new URL('/messages', discovery), project).search).toBe('');
  });
  it('uses page-specific breadcrumbs rather than describing all pages as projects', () => {
    expect(navigationTitle('/my-time', '')).toBe('Giờ làm của tôi');
    expect(navigationTitle('/teams', '?view=applications')).toBe(
      'Đơn ứng tuyển',
    );
    expect(navigationTitle('/requests', '?view=mine')).toBe('Yêu cầu đã đăng');
    expect(navigationTitle('/profile', '')).toBe('Hồ sơ cá nhân');
  });
});
