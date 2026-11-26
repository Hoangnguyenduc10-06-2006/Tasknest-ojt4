import { BrandLogo } from '../../../shared/ui/BrandLogo';
import { Icon } from '../../../shared/ui/Icon';
import { useEffect, useRef } from 'react';
import type { ShellData } from '../layout.types';
import { areaHref, navigateTo } from '../../router/location';
import { usePathname } from '../../router/usePathname';
import {
  connectionNavigation,
  discoveryNavigation,
  workNavigation,
  teamNavigation,
  navigationArea,
  selectedNavigation,
  type NavigationItem,
} from '../navigation';

const workspaceAreas = [
  { key: 'work', href: '/dashboard', label: 'Làm việc', icon: 'folder' },
  { key: 'discovery', href: '/customer-overview', guestHref: '/discovery', label: 'Khám phá', icon: 'search' },
  { key: 'team', href: '/team-management', guestHref: '/login?returnTo=%2Fteam-management', label: 'Quản lý đội', icon: 'users' },
] as const;

const projectTones = {
  accent: 'bg-tint text-accent',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  review: 'bg-review-soft text-review',
};
type SidebarContentProps = Pick<
  ShellData,
  'myTaskCount' | 'hasPendingInvitations' | 'recentProjects' | 'client' | 'canWork' | 'ownsTeam' | 'memberOfTeam' | 'hasTeamInvitations'
> & {
  unreadMessages: number;
  pathname: string;
  search: string;
  mobile?: boolean;
  guest: boolean;
  onClose: () => void;
};
function SidebarContent({
  pathname,
  search,
  mobile = false,
  guest,
  onClose,
  myTaskCount,
  hasPendingInvitations,
  recentProjects,
  client = false,
  canWork = true,
  ownsTeam = false,
  memberOfTeam = false,
  hasTeamInvitations = false,
  unreadMessages,
}: SidebarContentProps) {
  const areas = workspaceAreas.filter(item => item.key === 'discovery' || (item.key === 'work' ? canWork && !guest : ownsTeam));
  const routeArea = navigationArea(pathname, search);
  const area = areas.some(item => item.key === routeArea) ? routeArea : client || guest ? 'discovery' : 'work';
  const discovery = area === 'discovery';
  const selected = selectedNavigation(pathname, search);
  function group(label: string, items: NavigationItem[]) {
    return (
      <section className="mt-5">
        <h2 className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {label}
        </h2>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={areaHref(item.href)}
                aria-current={selected === item.href ? 'page' : undefined}
                className={
                  'workspace-nav-link group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent active:scale-[0.98] ' +
                  (selected === item.href
                    ? 'bg-tint font-semibold text-accent'
                    : 'text-muted hover:bg-field hover:text-ink')
                }
              >
                <span className="shrink-0">
                  <Icon name={item.icon} size={18} />
                </span>
                <span className="min-w-0 flex-1 leading-5">{item.label}</span>
                {item.href.startsWith('/messages') && unreadMessages > 0 && (
                  <span
                    aria-label={unreadMessages + ' tin nhắn chưa đọc'}
                    className="rounded-full bg-accent px-2 text-[11px] font-semibold text-on-accent"
                  >
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
                {item.badge && myTaskCount !== undefined && (
                  <span className="min-w-5 rounded-md bg-field px-1.5 text-center text-[11px] font-semibold text-muted">
                    {myTaskCount}
                  </span>
                )}
                {item.dot && hasPendingInvitations && (
                  <span
                    aria-label="Có mục mới"
                    className="size-1.5 rounded-full bg-accent"
                  />
                )}
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      onClick={(event) => {
        if (
          mobile &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.target instanceof Element &&
          event.target.closest('a')
        )
          onClose();
      }}
    >
      <div className="flex h-[68px] shrink-0 items-center gap-3 px-5">
        <a
          href={guest ? '/teams' : client ? '/customer-overview' : '/dashboard'}
          aria-label="TaskNest · Trang chính"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <BrandLogo />
        </a>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            data-close-menu
            className="ml-auto inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-field lg:hidden"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      {areas.length > 1 && <nav aria-label="Khu vực TaskNest" className="mx-3 mb-1 shrink-0 rounded-2xl border border-line bg-panel p-1">
        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${areas.length}, minmax(0, 1fr))` }}>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 rounded-xl bg-surface shadow-sm ring-1 ring-inset ring-accent/20 motion-safe:transition-transform motion-safe:duration-250 motion-safe:ease-out"
            style={{ width: `${100 / areas.length}%`, transform: `translateX(${areas.findIndex(item => item.key === area) * 100}%)` }}
          />
          {areas.map(item => {
            const href = guest && 'guestHref' in item ? item.guestHref : item.href;
            const active = item.key === area;
            return (
              <a
                key={item.key}
                href={href}
                aria-label={item.label}
                aria-current={active ? 'true' : undefined}
                onClick={event => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || guest) return;
                  event.preventDefault();
                  if (pathname !== href || search) navigateTo(href);
                }}
                className={`group/area relative flex min-h-11 min-w-0 items-center justify-center rounded-xl focus-visible:outline-2 focus-visible:outline-accent motion-safe:transition-colors ${active ? 'text-accent' : 'text-muted hover:text-ink'}`}
              >
                <Icon name={item.icon} size={19} />
                <span aria-hidden="true" className="workspace-area-hint pointer-events-none invisible absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink opacity-0 shadow-panel group-hover/area:visible group-hover/area:opacity-100 group-focus-visible/area:visible group-focus-visible/area:opacity-100">
                  {item.label}
                </span>
              </a>
            );
          })}
        </div>
      </nav>}
      <nav
        aria-label={discovery ? 'Menu khám phá' : 'Menu làm việc'}
        className="flex-1 overflow-y-auto px-3 pb-5"
      >
        {area === 'team' ? group('Quản lý đội', teamNavigation) : discovery && client ? (
          group('Dành cho khách hàng', [
            { href: '/customer-overview', label: 'Tổng quan khách hàng', icon: 'home' },
            { href: '/requests?view=mine', label: 'Yêu cầu đã đăng', icon: 'list' },
            { href: '/teams', label: 'Tìm đội phát triển', icon: 'users' },
            { href: '/customer-overview#customer-proposals', label: 'Đề xuất đã nhận', icon: 'inbox' },
            { href: '/customer-overview#customer-projects', label: 'Dự án đang thuê', icon: 'folder' },
            ...(hasTeamInvitations ? [{ href: '/team-management', label: 'Lời mời vào đội', icon: 'inbox' as const }] : []),
            { href: '/discovery', label: 'Bảng tin', icon: 'search' },
            { href: '/connections?area=discovery', label: 'Kết nối', icon: 'users' },
          ])
        ) : discovery ? (
          <>
            {group('Khám phá', discoveryNavigation)}
            {!guest && group('Kết nối của tôi', connectionNavigation)}
            <div className="mx-1 mt-5 space-y-2 rounded-xl border border-line bg-panel p-3">
              <p className="text-xs leading-5 text-muted">
                {guest
                  ? 'Đăng nhập để gửi đề xuất, tìm đồng đội và quản lý dự án.'
                  : 'Từ kết nối đến bàn giao, mọi công việc được theo dõi trong dự án.'}
              </p>
              <a
                href={guest ? '/login?returnTo=/requests' : '/my-projects'}
                className="inline-block text-xs font-semibold text-accent"
              >
                {guest ? 'Đăng nhập TaskNest →' : 'Mở dự án của tôi →'}
              </a>
            </div>
          </>
        ) : (
          <>
            {group('Làm việc', workNavigation)}
            {!ownsTeam && (memberOfTeam || !client) && group(memberOfTeam ? 'Đội của bạn' : 'Đội phát triển', [
              { href: '/team-management', label: memberOfTeam ? 'Đội của tôi' : 'Tạo đội', icon: 'users' },
            ])}
            {recentProjects.length > 0 && (
              <section className="mt-5 border-t border-line pt-4">
                <h2 className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                  Dự án gần đây
                </h2>
                <ul className="space-y-1">
                  {recentProjects.map((project) => (
                    <li key={project.id}>
                      <a
                        href={'/projects/' + project.id}
                        aria-current={
                          pathname === '/projects/' + project.id
                            ? 'page'
                            : undefined
                        }
                        className={
                          'flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-150 ease-out active:scale-[0.98] ' +
                          (pathname === '/projects/' + project.id
                            ? 'bg-tint'
                            : 'hover:bg-field')
                        }
                      >
                        <span
                          className={
                            'inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ' +
                            projectTones[project.tone]
                          }
                        >
                          {project.initial}
                        </span>
                        <span className="min-w-0 truncate text-sm font-semibold">
                          {project.name}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </nav>
      <footer className="shrink-0 border-t border-line px-5 py-4 text-center">
        <p className="m-0 text-[10px] text-muted">
          © {new Date().getFullYear()} TaskNest
        </p>
      </footer>
    </div>
  );
}
type SideBarProps = Pick<
  SidebarContentProps,
  'myTaskCount' | 'hasPendingInvitations' | 'recentProjects' | 'onClose' | 'unreadMessages' | 'client' | 'canWork' | 'ownsTeam' | 'memberOfTeam' | 'hasTeamInvitations'
> & { open: boolean; guest?: boolean };

export function SideBar({
  open,
  onClose,
  guest = false,
  ...data
}: SideBarProps) {
  const pathname = usePathname();
  const search = window.location.search;
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    if (!open || desktop.matches) return;

    // Native modal dialog makes the background inert and traps/restores focus.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('[data-close-menu]')?.focus();
    const handleDesktop = () => {
      if (desktop.matches) onClose();
    };
    desktop.addEventListener('change', handleDesktop);
    return () => {
      desktop.removeEventListener('change', handleDesktop);
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      <aside
        aria-label="Điều hướng chính"
        className="workspace-sidebar sticky top-0 hidden h-dvh w-[228px] shrink-0 border-r border-line bg-surface text-ink lg:block"
      >
        <SidebarContent
          {...data}
          pathname={pathname}
          search={search}
          guest={guest}
          onClose={onClose}
        />
      </aside>
      <dialog
        ref={dialogRef}
        id="app-sidebar"
        aria-label="Điều hướng chính"
        className="workspace-sidebar motion-drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(18rem,88vw)] max-w-none border-0 bg-surface p-0 text-ink backdrop:bg-black/40 lg:hidden"
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.target === event.currentTarget &&
            (event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom)
          )
            onClose();
        }}
      >
        <SidebarContent
          {...data}
          pathname={pathname}
          search={search}
          guest={guest}
          mobile
          onClose={onClose}
        />
      </dialog>
    </>
  );
}
