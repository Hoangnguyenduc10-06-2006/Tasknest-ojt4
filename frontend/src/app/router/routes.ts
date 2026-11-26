const workspacePages: Record<string, string> = {
  '/tasks-needing-review': 'Nhiệm vụ cần duyệt',
  '/my-tasks': 'Công việc của tôi',
  '/my-projects': 'Dự án của tôi',
  '/projects': 'Dự án của tôi',
  '/tasks': 'Công việc của tôi',
  '/my-invitations': 'Lời mời và yêu cầu',
  '/my-time': 'Giờ làm của tôi',
  '/invitations': 'Lời mời và yêu cầu',
  '/notifications': 'Thông báo',
  '/tasks/new': 'Tạo nhiệm vụ',
  '/messages': 'Tin nhắn',
  '/connections': 'Kết nối',
  '/cooperations': 'Hợp tác của tôi',
  '/team-management': 'Quản lý đội',
  '/customer-overview': 'Tổng quan khách hàng',
  '/setup': 'Thiết lập tài khoản',
};

type Route =
  | {
      kind:
        | 'welcome'
        | 'login'
        | 'register'
        | 'forgot-password'
        | 'reset-password'
        | 'verify-email'
        | 'services'
        | 'session'
        | 'dashboard'
        | 'profile'
        | 'community'
        | 'not-found';
    }
  | { kind: 'workspace'; title: string };

export function resolveRoute(pathname: string): Route {
  if (pathname === '/discovery' || pathname === '/requests' || /^\/requests\/[1-9]\d*$/.test(pathname))
    return { kind: 'community' };
  if (
    pathname === '/teams' ||
    /^\/teams\/[1-9]\d*$/.test(pathname) ||
    /^\/members\/[0-9a-f-]{36}$/.test(pathname)
  )
    return { kind: 'community' };
  if (pathname === '/') return { kind: 'welcome' };
  if (pathname === '/verify-email') return { kind: 'verify-email' };
  if (pathname === '/login') return { kind: 'login' };
  if (pathname === '/register') return { kind: 'register' };
  if (pathname === '/reset-password') return { kind: 'reset-password' };
  if (pathname === '/forgot-password') return { kind: 'forgot-password' };
  if (import.meta.env.DEV && pathname === '/dev/services')
    return { kind: 'services' };
  if (pathname === '/auth/session') return { kind: 'session' };
  if (pathname === '/profile') return { kind: 'profile' };
  if (pathname === '/dashboard') return { kind: 'dashboard' };
  const title = Object.hasOwn(workspacePages, pathname)
    ? workspacePages[pathname]
    : undefined;
  if (title) return { kind: 'workspace', title };
  if (/^\/team-management\/[1-9]\d*$/.test(pathname)) return { kind: 'workspace', title: 'Quản lý đội' };
  if (/^\/join\/[0-9a-f]{64}$/.test(pathname))
    return { kind: 'workspace', title: 'Yêu cầu tham gia dự án' };
  if (/^\/projects\/[^/]+$/.test(pathname))
    return { kind: 'workspace', title: 'Chi tiết dự án' };
  if (/^\/tasks\/[^/]+$/.test(pathname))
    return { kind: 'workspace', title: 'Chi tiết nhiệm vụ' };
  return { kind: 'not-found' };
}

// Explicit public allowlist: new business routes are protected by default.
export function requiresSession(pathname: string) {
  if (resolveRoute(pathname).kind === 'community') return false;
  return ![
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ].includes(pathname);
}
export function isPrivateCommunityView(pathname: string, search: string) {
  const view = new URLSearchParams(search).get('view');
  return (
    (pathname === '/requests' && view === 'mine') ||
    (pathname === '/teams' && (view === 'mine' || view === 'applications'))
  );
}
export function safeReturnTo(value: string | null) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\r\n]/.test(value)
  )
    return '/dashboard';
  const pathname = value.split(/[?#]/, 1)[0];
  const route = resolveRoute(pathname);
  return (requiresSession(pathname) || route.kind === 'community') &&
    route.kind !== 'not-found'
    ? value
    : '/dashboard';
}

const sharedAreaPages = new Set(['/connections', '/messages', '/notifications', '/profile', '/cooperations']);

export function navigationArea(pathname: string, search = '') {
  const area = new URLSearchParams(search).get('area');
  if (pathname === '/team-management' || pathname.startsWith('/team-management/') || (sharedAreaPages.has(pathname) && area === 'team')) return 'team';
  return pathname === '/customer-overview' || resolveRoute(pathname).kind === 'community' || (sharedAreaPages.has(pathname) && area === 'discovery') ? 'discovery' : 'work';
}

export function withNavigationArea(destination: URL, current: Pick<URL, 'pathname' | 'search'>) {
  const area = navigationArea(current.pathname, current.search);
  if (sharedAreaPages.has(destination.pathname) && !destination.searchParams.has('area') && area !== 'work')
    destination.searchParams.set('area', area);
  return destination;
}
