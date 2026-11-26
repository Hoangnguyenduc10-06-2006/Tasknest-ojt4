import { ChatLauncher } from '../../features/messaging/ChatLauncher';
import { useSession } from '../../features/auth';
import { useChatResource } from '../../features/messaging/messaging.api';
import { usePathname } from '../router/usePathname';
import { useCallback, useState, type ReactNode } from 'react';
import { AiAssistant } from '../../features/ai';
import { Navbar } from './components/Navbar';
import { SideBar } from './components/SideBar';
import type { ShellData } from './layout.types';

type AppLayoutProps = {
  title?: string;
  guest?: boolean;
  assistant?: boolean;
  data: ShellData;
  timer?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppLayout({
  title,
  guest = false,
  assistant = true,
  data,
  timer,
  actions,
  children,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const session = useSession();
  const pathname = usePathname();
  const userId = !guest && session.status === 'authenticated' && session.user.emailVerified
    ? session.user.id : undefined;
  const unread = useChatResource<number>(userId ? '/unread' : null, userId, 30000);
  const unreadCount = unread.data ?? 0;

  const showChat = pathname !== '/messages' && pathname !== '/setup';
  const showAssistant = !guest && assistant;

  return (
    <div className={'app-shell flex min-h-screen bg-canvas text-ink' + (showChat || showAssistant ? ' with-launchers' : '')}>
      <a
        href="#tasknest-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-accent focus:px-4 focus:py-3 focus:text-on-accent"
      >
        Đi tới nội dung chính
      </a>
      <SideBar
        unreadMessages={unreadCount}
        guest={guest}
        client={data.client}
        canWork={data.canWork}
        ownsTeam={data.ownsTeam}
        memberOfTeam={data.memberOfTeam}
        hasTeamInvitations={data.hasTeamInvitations}
        open={sidebarOpen}
        onClose={closeSidebar}
        myTaskCount={data.myTaskCount}
        hasPendingInvitations={data.hasPendingInvitations}
        recentProjects={data.recentProjects}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar
          guest={guest}
          title={title}
          user={data.user}
          unreadCount={data.unreadCount}
          unreadMessages={unreadCount}
          timer={timer}
          actions={actions}
          menuOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen(true)}
        />
        {timer && (
          <div className="flex justify-end border-b border-line bg-surface px-4 py-2 sm:hidden">
            {timer}
          </div>
        )}
        <main id="tasknest-main" tabIndex={-1} className="page min-w-0 w-full flex-1">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>
      {showChat && (
        <ChatLauncher guest={guest} unreadCount={unreadCount} />
      )}
      {showAssistant && (
        <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-5 z-30">
          <AiAssistant />
        </div>
      )}
    </div>
  );
}
