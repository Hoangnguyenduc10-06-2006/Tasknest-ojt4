import { getSessionSnapshot } from '../features/auth/model/session.store';
import { useCommunityResource, type MyTeams } from '../features/community/community.api';
import { needsOnboarding } from '../features/profile/model/onboarding';
import { countActionableInvitations } from '../features/projects';
import { RealtimeBridge } from '../features/workspace/components/RealtimeBridge';
import { lazy, useCallback, useEffect } from 'react';
import {
  ForgotPasswordPage,
  ResetPasswordPage,
  LoginPage,
  RegisterPage,
  WelcomePage,
  VerifyEmailPage,
  registerAccount,
  checkSession,
  SessionPage,
  useSession,
} from '../features/auth';
import { useAvatarUrl } from '../features/profile';
import { buildDashboard } from '../features/dashboard';
import { ProtectedRoute } from './router/ProtectedRoute';
import {
  useProjectCollection,
  loadProjects,
  findProject,
} from '../features/projects';
import {
  useTasks,
  selectProjectTasks,
  summarizeTasks,
} from '../features/tasks';
import {
  TimerPill,
  useServerTimer,
} from '../features/time-tracking';
import { WorkspaceProvider, useWorkspace } from '../features/workspace';
import { useInbox, NotificationPopups } from '../features/notifications';
import { AppLayout } from './layouts/AppLayout';
import { RouteNoticePage } from './pages/RouteNoticePage';
import ServiceStatusPage from './pages/ServiceStatusPage';
import { navigateTo, replaceTo } from './router/location';
import {
  resolveRoute,
  safeReturnTo,
  isPrivateCommunityView,
} from './router/routes';
import { useClientNavigation } from './router/useClientNavigation';
import { usePathname } from './router/usePathname';

import { RouteContent } from './router/RouteContent';

const CooperationsPage = lazy(() => import('../features/community/CooperationsPage').then((module) => ({ default: module.CooperationsPage })));
const CustomerOverview = lazy(() => import('../features/community/AreaOverviews').then(module => ({ default: module.CustomerOverview })));
const TeamManagementPage = lazy(() => import('../features/community/TeamDirectoryPage').then(module => ({ default: module.TeamManagementPage })));
const ConnectionsPage = lazy(() => import('../features/community/ConnectionsPage').then((module) => ({ default: module.ConnectionsPage })));
const MessagesPage = lazy(() => import('../features/messaging/MessagesPage').then((module) => ({ default: module.MessagesPage })));
const TasksNeedingReviewPage = lazy(() => import('../features/tasks/pages/TasksNeedingReviewPage').then((module) => ({ default: module.TasksNeedingReviewPage })));
const OnboardingPage = lazy(() => import('../features/profile/pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })));
const CommunityPage = lazy(() => import('../features/community/TeamDirectoryPage').then((module) => ({ default: module.CommunityPage })));
const JoinProjectPage = lazy(() => import('../features/projects/pages/JoinProjectPage').then((module) => ({ default: module.JoinProjectPage })));
const ProjectDetailRoute = lazy(() => import('../features/projects/pages/ProjectDetailRoute').then((module) => ({ default: module.ProjectDetailRoute })));
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const MyProjectsPage = lazy(() => import('../features/projects/pages/MyProjectsPage').then((module) => ({ default: module.MyProjectsPage })));
const MyInvitationsPage = lazy(() => import('../features/projects/pages/MyInvitationsPage').then((module) => ({ default: module.MyInvitationsPage })));
const MyTasksPage = lazy(() => import('../features/tasks/pages/MyTasksPage').then((module) => ({ default: module.MyTasksPage })));
const NewTaskPage = lazy(() => import('../features/tasks/pages/NewTaskPage').then((module) => ({ default: module.NewTaskPage })));
const TaskDetailPage = lazy(() => import('../features/tasks/pages/TaskDetailPage').then((module) => ({ default: module.TaskDetailPage })));
const MyTimePage = lazy(() => import('../features/time-tracking/pages/MyTimePage').then((module) => ({ default: module.MyTimePage })));
const ProfilePage = lazy(() => import('../features/profile/pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const NotificationsPage = lazy(() => import('../features/notifications/pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));

export default function App() {
  const pathname = usePathname();
  useClientNavigation();
  const route = resolveRoute(pathname);
  const session = useSession();
  const guestPage = ['welcome', 'login', 'register'].includes(route.kind);
  useEffect(() => {
    if (guestPage || route.kind === 'community') void checkSession();
  }, [guestPage, route.kind]);
  useEffect(() => {
    if (guestPage && session.status === 'authenticated')
      replaceTo(
        safeReturnTo(
          new URLSearchParams(window.location.search).get('returnTo') ??
            (session.user.accountPurpose === 'CLIENT' ? '/customer-overview' : null),
        ),
      );
  }, [guestPage, session]);
  const finishVerification = useCallback(
    () => replaceTo('/login', { emailVerified: true }),
    [],
  );
  if (guestPage && session.status !== 'guest') {
    return (
      <main role="status" className="p-8 text-center">
        {session.status === 'error' ? (
          <>
            <p>{session.message}</p>
            <button onClick={() => void checkSession()}>Thử lại</button>
          </>
        ) : (
          'Đang kiểm tra phiên đăng nhập…'
        )}
      </main>
    );
  }
  if (
    route.kind === 'community' &&
    session.status !== 'authenticated' &&
    !isPrivateCommunityView(pathname, window.location.search)
  )
    return (
      <AppLayout
        guest
        data={{
          user: { name: '', initials: '', specialty: '' },
          hasPendingInvitations: false,
          recentProjects: [],
        }}
      >
        <RouteContent routeKey={pathname}>
          <CommunityPage key={pathname + window.location.search} pathname={pathname} />
        </RouteContent>
      </AppLayout>
    );
  if (route.kind === 'welcome') return <WelcomePage />;
  if (route.kind === 'register')
    return (
      <RegisterPage
        register={registerAccount}
        onRegistered={(email) =>
          navigateTo('/verify-email', { verificationEmail: email })
        }
      />
    );
  if (route.kind === 'verify-email')
    return (
      <VerifyEmailPage
        key={window.location.search}
        onVerified={finishVerification}
      />
    );
  if (route.kind === 'login')
    return (
      <LoginPage
        emailVerified={window.history.state?.emailVerified === true}
        onVerificationRequired={(email) =>
          navigateTo('/verify-email', { verificationEmail: email })
        }
        onSuccess={() => {
          let pending: string | null = null;
          try {
            pending = sessionStorage.getItem('tasknest.pendingJoin');
            sessionStorage.removeItem('tasknest.pendingJoin');
          } catch {
            /* Continue with the URL destination. */
          }
          const signedIn = getSessionSnapshot();
          const home = signedIn.status === 'authenticated' && signedIn.user.accountPurpose === 'CLIENT'
            ? '/customer-overview'
            : '/dashboard';
          replaceTo(
            safeReturnTo(
              new URLSearchParams(window.location.search).get('returnTo') ??
                pending ?? home,
            ),
          );
        }}
      />
    );
  if (route.kind === 'reset-password') return <ResetPasswordPage />;
  if (route.kind === 'forgot-password') return <ForgotPasswordPage />;
  return (
    <ProtectedRoute pathname={pathname}>
      {route.kind === 'services' ? (
        <ServiceStatusPage />
      ) : route.kind === 'session' ? (
        <SessionPage />
      ) : (
        <Workspace pathname={pathname} />
      )}
    </ProtectedRoute>
  );
}

function Workspace({ pathname }: { pathname: string }) {
  const session = useSession();
  return (
    <WorkspaceProvider
      userId={session.status === 'authenticated' ? session.user.id : undefined}
    >
      <WorkspaceContent pathname={pathname} />
    </WorkspaceProvider>
  );
}

function WorkspaceContent({ pathname }: { pathname: string }) {
  const route = resolveRoute(pathname);
  const session = useSession();
  const sessionUser =
    session.status === 'authenticated' ? session.user : undefined;
  const avatarUrl = useAvatarUrl(
    sessionUser?.id,
    sessionUser?.hasAvatar,
    sessionUser?.version,
  );
  const collection = useProjectCollection(sessionUser?.id);
  const projects = collection.projects;
  const teams = useCommunityResource<MyTeams>(sessionUser?.emailVerified ? 'community/me' : null);
  const client = sessionUser?.accountPurpose === 'CLIENT';
  const ownsTeam = teams.data?.teams.some(team => team.owner_user_id === sessionUser?.id) ?? false;
  const memberOfTeam = Boolean(teams.data?.teams.length);
  const canWork = !client || memberOfTeam || projects.some(project => project.role !== 'Customer');
  const showCustomerHome = client && !canWork && pathname === '/dashboard';

  const tasks = useTasks();
  const workspace = useWorkspace();
  const { timer, now, error: timerError, stopTimer } = useServerTimer();
  const inbox = useInbox(sessionUser?.id);
  const progressByProject = Object.fromEntries(
    projects.map((project) => [
      project.id,
      summarizeTasks(selectProjectTasks(tasks, project.id)).progress,
    ]),
  );
  const personalTasks = tasks
    .filter((task) => task.assignee.isCurrentUser)
    .map((task) => {
      const project = projects.find((item) => item.id === task.projectId);
      return {
        ...task,
        projectName: project?.name ?? 'Dự án',
        projectCode: project?.code ?? 'PR',
        projectTone: 'bg-tint text-accent',
        deadline: task.deadline ?? 'Chưa đặt hạn',
      };
    });
  const shell = {
    client, canWork, ownsTeam, memberOfTeam,
    hasTeamInvitations: Boolean(teams.data?.invitations.length),
    unreadCount: inbox.data?.unreadCount,
    hasPendingInvitations:
      countActionableInvitations(workspace.data?.invitations ?? []) > 0,
    recentProjects: projects
      .filter((project) => project.status === 'ACTIVE')
      .slice(0, 5)
      .map((project) => ({
        id: project.id,
        name: project.name,
        initial: project.code,
        tone: 'accent' as const,
      })),
    myTaskCount: workspace.data ? personalTasks.length : undefined,
    user: sessionUser
      ? {
          name: sessionUser.fullName,
          initials: sessionUser.fullName
            .trim()
            .split(/\s+/)
            .map((part) => part[0])
            .slice(-2)
            .join('')
            .toUpperCase(),
          specialty: sessionUser.jobTitle || sessionUser.email,
          avatarUrl,
        }
      : { name: '', initials: '', specialty: '' },
  };

  const setupNeeded = needsOnboarding(sessionUser) && pathname !== '/setup';
  useEffect(() => {
    if (setupNeeded)
      replaceTo(
        '/setup?returnTo=' +
          encodeURIComponent(window.location.pathname + window.location.search),
      );
  }, [setupNeeded]);

  useEffect(() => {
    if (!setupNeeded && showCustomerHome) replaceTo('/customer-overview');
  }, [setupNeeded, showCustomerHome]);

  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/);
  const project = projectMatch
    ? findProject(projects, projectMatch[1])
    : undefined;
  const projectRoute =
    Boolean(projectMatch) ||
    pathname === '/my-projects' ||
    pathname === '/projects';
  const content = setupNeeded || showCustomerHome ? (
    <p role="status">{setupNeeded ? 'Đang mở thiết lập tài khoản…' : 'Đang mở tổng quan khách hàng…'}</p>
  ) : pathname === '/setup' && sessionUser ? (
    <OnboardingPage user={sessionUser} />
  ) : pathname === '/customer-overview' && sessionUser ? (
    <CustomerOverview />
  ) : (pathname === '/team-management' || pathname.startsWith('/team-management/')) && sessionUser ? (
    <TeamManagementPage key={pathname} pathname={pathname} />
  ) : pathname === '/connections' && sessionUser ? (
    <ConnectionsPage />
  ) : pathname === '/cooperations' && sessionUser ? (
    <CooperationsPage />
  ) : pathname === '/messages' && sessionUser ? (
    <MessagesPage user={sessionUser} />
  ) : route.kind === 'community' ? (
    <CommunityPage
      key={pathname + window.location.search}
      pathname={pathname}
    />
  ) : !projectMatch &&
    (projectRoute ||
      (route.kind !== 'profile' && pathname !== '/notifications')) &&
    collection.status !== 'ready' &&
    !pathname.startsWith('/join/') ? (
    <div
      role="status"
      className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted"
    >
      {collection.status === 'error' ? collection.error : 'Đang tải dự án...'}
      {collection.status === 'error' && (
        <button
          className="ml-3 text-accent"
          onClick={() => {
            if (sessionUser) void loadProjects(sessionUser.id);
          }}
        >
          Thử lại
        </button>
      )}
    </div>
  ) : route.kind === 'profile' ? (
    <ProfilePage />
  ) : pathname === '/notifications' && sessionUser ? (
    <NotificationsPage inbox={inbox} userId={sessionUser.id} />
  ) : workspace.loading || (!workspace.data && workspace.error) ? (
    <div
      role="status"
      className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted"
    >
      {workspace.error ?? 'Đang tải dữ liệu...'}
      {workspace.error && (
        <button
          className="ml-3 text-accent"
          onClick={() => {
            void workspace.refresh();
          }}
        >
          Thử lại
        </button>
      )}
    </div>
  ) : /^\/join\/[0-9a-f]{64}$/.test(pathname) && sessionUser ? (
    <JoinProjectPage
      key={pathname}
      code={pathname.split('/')[2]}
      userId={sessionUser.id}
    />
  ) : pathname === '/my-time' ? (
    <MyTimePage now={now} timer={timer} onStopTimer={stopTimer} />
  ) : pathname === '/tasks/new' ? (
    <NewTaskPage />
  ) : /^\/tasks\/[^/]+$/.test(pathname) ? (
    tasks.find((task) => task.id === pathname.split('/')[2]) ? (
      <TaskDetailPage
        key={pathname}
        task={tasks.find((task) => task.id === pathname.split('/')[2])!}
      />
    ) : (
      <RouteNoticePage />
    )
  ) : projectMatch ? (
    <ProjectDetailRoute
      key={`${sessionUser?.id}/${projectMatch[1]}`}
      projectId={projectMatch[1]}
      tasks={selectProjectTasks(tasks, projectMatch[1])}
    />
  ) : pathname === '/invitations' || pathname === '/my-invitations' ? (
    <MyInvitationsPage />
  ) : pathname === '/tasks-needing-review' ? (
    <TasksNeedingReviewPage tasks={tasks} projects={projects} />
  ) : pathname === '/my-tasks' || pathname === '/tasks' ? (
    <MyTasksPage key={window.location.search} tasks={
      new URLSearchParams(window.location.search).get('scope') === 'active'
        ? personalTasks.filter(task => projects.some(project => project.id === task.projectId && project.status === 'ACTIVE'))
        : personalTasks
    } now={now} />
  ) : pathname === '/my-projects' || pathname === '/projects' ? (
    <MyProjectsPage progressByProject={progressByProject} />
  ) : route.kind === 'dashboard' ? (
    <DashboardPage
      data={buildDashboard(
        sessionUser?.fullName ?? '',
        tasks,
        projects,
        workspace.data?.members ?? [],
        now,
      )}
      timer={timer}
      onStopTimer={stopTimer}
      onCreateTask={() => navigateTo('/tasks/new')}
    />
  ) : (
    <RouteNoticePage />
  );

  return (
    <AppLayout
      assistant={pathname !== '/setup'}
      data={shell}
      title={project?.name ?? 'Không gian cá nhân'}
      timer={timer && <TimerPill timer={timer} onStop={stopTimer} />}
    >
      {timerError && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-danger p-3 text-sm text-danger"
        >
          {timerError}
        </p>
      )}
      {route.kind !== 'community' &&
        pathname !== '/setup' &&
        workspace.error &&
        workspace.data && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-warning p-3 text-sm text-warning"
          >
            {workspace.error} Dữ liệu đang hiển thị là lần tải thành công gần
            nhất.
            <button
              className="ml-3 underline"
              onClick={() => {
                void workspace.refresh();
              }}
            >
              Thử lại
            </button>
          </p>
        )}
      <RealtimeBridge
        userId={sessionUser?.id}
        showStatus={route.kind !== 'community' && pathname !== '/setup'}
      />
      <NotificationPopups key={sessionUser?.id} inbox={inbox} />
      <RouteContent routeKey={pathname}>{content}</RouteContent>
    </AppLayout>
  );
}
