import type { ReactNode } from 'react';
import { LogoutButton } from '../../../features/auth';
import { areaHref } from '../../router/location';
import { usePathname } from '../../router/usePathname';
import { ThemeSwitcher } from '../../../shared/theme/ThemeSwitcher';
import { useTheme } from '../../../shared/theme/useTheme';
import type { LayoutUser } from '../layout.types';
import { Icon } from '../../../shared/ui/Icon';
import { navigationTitle } from '../navigation';

type NavbarProps = {
  title?: string;
  guest?: boolean;
  user: LayoutUser;
  unreadCount?: number;
  unreadMessages: number;
  timer?: ReactNode;
  actions?: ReactNode;
  menuOpen: boolean;
  onMenuClick: () => void;
};

export function Navbar({
  title = 'Không gian cá nhân',
  guest = false,
  user,
  unreadCount,
  unreadMessages,
  timer,
  actions,
  menuOpen,
  onMenuClick,
}: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const notificationsActive = pathname === '/notifications';
  const pageTitle =
    /^\/projects\/[^/]+$/.test(pathname) && title !== 'Không gian cá nhân'
      ? title
      : navigationTitle(pathname, window.location.search);
  return (
    <header className="sticky top-0 z-20 flex h-[68px] shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Mở menu"
        aria-controls="app-sidebar"
        aria-expanded={menuOpen}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink lg:hidden"
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <span className="hidden min-w-0 truncate text-sm font-semibold text-muted sm:inline">{pageTitle}</span>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {timer && <div className="hidden sm:block">{timer}</div>}
        {actions}
        <div className="hidden sm:block"><ThemeSwitcher value={theme} onChange={setTheme} /></div>
        {!guest && (
          <>
            <a
              href={areaHref('/messages')}
              aria-current={pathname === '/messages' ? 'page' : undefined}
              aria-label={unreadMessages ? `Tin nhắn (${unreadMessages} chưa đọc)` : 'Tin nhắn'}
              title="Tin nhắn"
              className={`relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl border ${pathname === '/messages' ? 'border-accent bg-tint text-accent' : 'border-line bg-surface text-muted hover:text-ink'}`}
            >
              <Icon name="message" size={18} />
              {unreadMessages > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-bold text-on-accent">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}
            </a>
            <a
              href={areaHref("/notifications")}
              aria-current={notificationsActive ? 'page' : undefined}
              aria-label={
                unreadCount === undefined
                  ? 'Thông báo'
                  : `Thông báo (${unreadCount} chưa đọc)`
              }
              className={`relative inline-flex size-9 items-center justify-center rounded-xl border focus-visible:outline-2 focus-visible:outline-accent ${notificationsActive ? 'border-accent bg-tint text-accent' : 'border-line bg-surface text-muted hover:text-ink'}`}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
              {unreadCount !== undefined && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-4 text-canvas">
                  {unreadCount}
                </span>
              )}
            </a>
            <a
              href={areaHref("/profile")}
              aria-label={`Hồ sơ của ${user.name}`}
              className="flex items-center gap-2.5 rounded-xl p-1 hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-tint text-[11px] font-bold text-accent">
                  {user.initials}
                </span>
              )}
              <span className="hidden max-w-40 text-right leading-tight sm:block">
                <span className="block truncate text-xs font-semibold">
                  {user.name}
                </span>
                <span className="block truncate text-[10px] text-muted">
                  {user.specialty}
                </span>
              </span>
              <span className="hidden text-muted sm:block">
                <Icon name="chevron" size={14} />
              </span>
            </a>
            <LogoutButton />
          </>
        )}
        {guest && (
          <a
            href={
              '/login?returnTo=' +
              encodeURIComponent(
                window.location.pathname + window.location.search,
              )
            }
            className="shrink-0 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-on-accent"
          >
            Đăng nhập
          </a>
        )}
      </div>
    </header>
  );
}
