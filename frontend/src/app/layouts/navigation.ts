import type { IconName } from '../../shared/ui/Icon';
export { navigationArea } from '../router/routes';

export type NavigationItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: boolean;
  dot?: boolean;
};
export const workNavigation: NavigationItem[] = [
  { href: '/dashboard', label: 'Tổng quan', icon: 'home' },
  { href: '/my-tasks', label: 'Công việc của tôi', icon: 'check', badge: true },
  { href: '/tasks-needing-review', label: 'Nhiệm vụ cần duyệt', icon: 'list' },
  { href: '/my-projects', label: 'Dự án của tôi', icon: 'folder' },
  {href:'/cooperations',label:'Hợp tác của tôi',icon:'users'},
  { href: '/connections', label: 'Kết nối', icon: 'users' },
  { href: '/my-time', label: 'Giờ làm của tôi', icon: 'clock' },
  {
    href: '/invitations',
    label: 'Lời mời và yêu cầu',
    icon: 'inbox',
    dot: true,
  },
];
export const discoveryNavigation: NavigationItem[] = [
  { href: '/customer-overview', label: 'Tổng quan khách hàng', icon: 'home' },
  { href: '/discovery', label: 'Bảng tin', icon: 'list' },
  { href: '/teams', label: 'Tìm đội phát triển', icon: 'users' },
  { href: '/requests', label: 'Tìm dự án', icon: 'search' },
  { href: '/teams?view=recruiting', label: 'Cơ hội tham gia', icon: 'plus' },
];
export const connectionNavigation: NavigationItem[] = [
  {href:'/cooperations?area=discovery',label:'Hợp tác của tôi',icon:'users'},
  { href: '/connections?area=discovery', label: 'Kết nối', icon: 'users' },
  { href: '/requests?view=mine', label: 'Yêu cầu đã đăng', icon: 'folder' },
  { href: '/teams?view=applications', label: 'Đơn ứng tuyển', icon: 'inbox' },
];

export const teamNavigation: NavigationItem[] = [
  { href: '/team-management', label: 'Tổng quan đội', icon: 'home' },
  { href: '/cooperations?area=team&view=proposals', label: 'Đề xuất của đội', icon: 'list' },
  { href: '/connections?area=team', label: 'Kết nối', icon: 'users' },
];

export function selectedNavigation(pathname: string, search: string) {
  if (pathname.startsWith('/team-management/')) return '/team-management';
  if (pathname === '/cooperations' && new URLSearchParams(search).get('area') === 'team') return '/cooperations?area=team&view=proposals';
  if (pathname === '/connections' && new URLSearchParams(search).get('area') === 'team') return '/connections?area=team';
  if (pathname === '/cooperations') return new URLSearchParams(search).get('area') === 'discovery'?'/cooperations?area=discovery':'/cooperations';
  if (pathname === '/connections') return new URLSearchParams(search).get('area') === 'discovery' ? '/connections?area=discovery' : '/connections';
  if (pathname === '/messages')
    return new URLSearchParams(search).get('area') === 'discovery'
      ? '/messages?area=discovery'
      : '/messages';
  const view = new URLSearchParams(search).get('view');
  if (pathname === '/requests')
    return view === 'mine' ? '/requests?view=mine' : '/requests';
  if (pathname.startsWith('/requests/')) return '/requests';
  if (pathname === '/teams')
    return ['mine', 'recruiting', 'applications'].includes(view ?? '')
      ? '/teams?view=' + view
      : '/teams';
  if (pathname.startsWith('/teams/') || pathname.startsWith('/members/'))
    return '/teams';
  if (pathname === '/projects' || pathname.startsWith('/projects/'))
    return '/my-projects';
  if (pathname === '/tasks' || pathname.startsWith('/tasks/'))
    return '/my-tasks';
  if (pathname === '/my-invitations') return '/invitations';
  return pathname;
}
export function navigationTitle(pathname: string, search: string) {
  if (pathname === '/discovery') return 'Bảng tin';
  if (pathname.startsWith('/team-management/')) return 'Chi tiết đội';
  if (/^\/requests\//.test(pathname)) return 'Chi tiết yêu cầu';
  if (/^\/teams\//.test(pathname)) return 'Hồ sơ đội';
  if (/^\/members\//.test(pathname)) return 'Hồ sơ thành viên';
  if (pathname === '/setup') return 'Thiết lập tài khoản';
  if (pathname === '/profile') return 'Hồ sơ cá nhân';
  if (pathname === '/notifications') return 'Thông báo';
  if (pathname === '/tasks/new') return 'Tạo nhiệm vụ';
  if (pathname.startsWith('/tasks/')) return 'Chi tiết nhiệm vụ';
  if (pathname.startsWith('/join/')) return 'Tham gia dự án';
  const selected = selectedNavigation(pathname, search);
  return (
    [...workNavigation, ...discoveryNavigation, ...connectionNavigation, ...teamNavigation].find(
      (item) => item.href === selected,
    )?.label ?? 'Không gian làm việc'
  );
}
