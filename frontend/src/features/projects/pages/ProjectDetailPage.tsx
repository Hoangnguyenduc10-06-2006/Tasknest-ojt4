import { CreateTaskModal } from '../../tasks/components/modals/CreateTaskModal';
import { canDevelopProject, developmentReadOnlyReason } from '../model/project.validation';
import { ProjectAgreement } from '../../community/ProjectAgreement';
import { CustomerProjectOverview } from '../components/overview/CustomerProjectOverview';
import { RoleBadge } from '../../../shared/ui/RoleBadge';
import { ProjectSettings } from '../components/ProjectSettings';
import { ProjectResources } from '../../collaboration';
import { ProjectReputation } from '../../community/ProjectReputation';
import { ProjectMilestones } from '../../community/ProjectMilestones';
import { useState } from 'react';
import { useSession } from '../../auth';
import { useWorkspace } from '../../workspace';
import { ProjectMembersView } from '../components/members/ProjectMembersView';
import {
  TaskBoard,
  type Task,
  type TaskStatus,
} from '../../tasks';
import type { MyProjectItem } from '../model/project.types';
import {
  canArchiveOrReopenProject,
  canEditProject,
  getProjectReadOnlyReason,
  hasRunningTimerInProject,
  isProjectReadOnly,
  validateProjectArchiveAction,
} from '../model/project.validation';
import {
  archiveStoredProject,
  loadProjects,
  reopenStoredProject,
} from '../model/project.store';
import { ProjectOverviewView } from '../components/overview/ProjectOverviewView';
import { ProjectActivityFeed } from '../components/overview/ProjectActivityFeed';
import { useProjects } from '../hooks/useProjects';
import { EditProjectModal } from '../components/modals/EditProjectModal';
import { ProjectAvatar } from '../components/ProjectAvatar';
import { Tabs } from '../../../shared/ui/Tabs';
import { Badge } from '../../../shared/ui/Badge';
import { UserAvatar as Avatar } from '../../profile/components/UserAvatar';
import { Button } from '../../../shared/ui/Button';
import { ChatLink } from '../../messaging/ChatLink';

interface Props {
  project: MyProjectItem;
  tasks: Task[];
}
export function ProjectDetailPage({ project, tasks }: Props) {
  const [requestedTab, setTab] = useState<'overview' | 'tasks' | 'members' | 'resources' | 'milestones' | 'reputation' | 'activities' | 'settings'>(
    () => {
      const requested=new URLSearchParams(window.location.search).get('tab');
      return requested==='tasks'||requested==='members'||requested==='resources'||requested==='milestones'||requested==='reputation'||requested==='activities'||requested==='settings'?requested:'overview';
    },
  );
  const customer = project.role === 'Customer';
  const tab = customer && !['overview', 'milestones', 'reputation'].includes(requestedTab) ? 'overview' : requestedTab;
  const [filter, setFilter] = useState<TaskStatus | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [taskDeadline, setTaskDeadline] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const session = useSession();
  const workspace = useWorkspace();
  const projects = useProjects();
  const editable = canEditProject(project);
  const canArchiveOrReopen = canArchiveOrReopenProject(project);
  const hasRunningTimer = hasRunningTimerInProject(
    project.id,
    workspace.data?.timeEntries,
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
  };
  const archived = isProjectReadOnly(project);
  const taskReadOnly = !canDevelopProject(project);
  const developmentReason = developmentReadOnlyReason(project);
  const members = workspace.data?.members.filter(member => member.projectId === project.id) ?? [];
  const readOnlyReason = getProjectReadOnlyReason(project);
  const openTasks = (status?: TaskStatus) => {
    setFilter(status);
    setTab('tasks');
  };

  const handleArchiveToggle = async () => {
    if (session.status !== 'authenticated') {
      showToast('Vui lòng đăng nhập lại.');
      return;
    }
    const validationError = validateProjectArchiveAction(
      project,
      workspace.data?.timeEntries,
    );
    if (validationError) {
      showToast(validationError);
      return;
    }
    setIsArchiving(true);
    try {
      if (project.status === 'ACTIVE') {
        const result = await archiveStoredProject(
          session.user.id,
          project.id,
          project.version!,
        );
        showToast(`Đã lưu trữ dự án "${result.name}".`);
      } else {
        const result = await reopenStoredProject(
          session.user.id,
          project.id,
          project.version!,
        );
        showToast(`Đã khôi phục dự án "${result.name}".`);
      }
      await workspace.refresh();
    } catch (err) {
      await loadProjects(session.user.id);
      await workspace.refresh();
      showToast(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật trạng thái lưu trữ dự án.',
      );
    } finally {
      setIsArchiving(false);
    }
  };
  return (
    <div className="project-page space-y-6">
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink shadow-xl animate-in slide-in-from-bottom-5"
        >
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}
      <a
        href="/my-projects"
        className="sr-only focus:not-sr-only focus:text-accent"
      >
        ← Dự án của tôi
      </a>
      <header className="project-title flex-wrap">
        <div className="flex min-w-0 items-start gap-4">
          <ProjectAvatar
            code={project.code}
            name={project.name} projectId={project.id}
            colorClass={project.iconBgClass}
            imageUrl={project.imageUrl}
            className="size-10"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Dự án
            </p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight">
              {project.name}
            </h1>
            <details className="mt-1 text-xs text-muted">
            <summary className="cursor-pointer">Thông tin dự án</summary>
            <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-muted">
              {project.description}
            </p>
            <p className="mt-3 text-xs text-muted">
              {project.dateRange} · <RoleBadge role={project.role} />
            </p>
            </details>
          </div>
        </div>
        <div className="project-people flex items-center">
          {!customer && <div className="avatar-stack" aria-label={`${members.length} thành viên`}>
            {members.slice(0,3).map(member => <Avatar key={member.id} userId={member.id} projectId={project.id} name={member.name} tone={member.role === 'Owner' ? 'purple' : member.role === 'Manager' ? 'green' : 'blue'} />)}
          </div>}
          {!customer && members.length > 3 && <span>+{members.length - 3}</span>}
          {archived && <Badge>Đã lưu trữ</Badge>}
          {project.developmentState === 'COMPLETED' && <Badge>Đã hoàn thành</Badge>}
          <ChatLink destination={{ kind: 'project', id: project.id }} className="!min-h-9 !px-3 !py-1.5">Trao đổi dự án</ChatLink>
          {!customer && <Button kind="secondary" icon="users" onClick={() => setTab('members')}>Thành viên</Button>}
        </div>
      </header>
      {!archived && project.developmentState === 'COMPLETED' && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4 text-sm">
          <p>{developmentReason}</p>
          <Button kind="secondary" size="sm" onClick={() => setTab('reputation')}>Xem nghiệm thu và yêu cầu mở lại</Button>
        </div>
      )}
      {archived && (
        <div
          role="status"
          className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-panel p-4 text-sm text-muted sm:flex-row sm:items-center"
        >
          <p>{readOnlyReason}</p>
          {canArchiveOrReopen && (
            <button
              type="button"
              disabled={isArchiving}
              onClick={() => void handleArchiveToggle()}
              className="shrink-0 rounded-xl border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-field disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isArchiving ? 'Đang xử lý...' : 'Khôi phục dự án'}
            </button>
          )}
        </div>
      )}
      <Tabs<typeof tab> value={tab} onChange={(value) => { setTab(value); setFilter(undefined); }} items={([
        { value: 'overview', label: 'Tổng quan' },
        { value: 'tasks', label: 'Nhiệm vụ', count: tasks.length },
        { value: 'members', label: 'Thành viên' },
        { value: 'resources', label: 'Tài liệu & Liên kết' },
        { value: 'milestones', label: 'Mốc bàn giao' },
        { value: 'reputation', label: 'Nghiệm thu & Đánh giá' },
        { value: 'activities', label: 'Hoạt động' },
        { value: 'settings', label: 'Cài đặt' },
      ] as const).filter(item => !customer || ['overview', 'milestones', 'reputation'].includes(item.value))} />
      {!archived && project.developmentState !== 'COMPLETED' && developmentReason && <p role="status" className="rounded-xl border border-line bg-panel p-4 text-sm text-muted">{developmentReason}</p>}
      <div key={tab} className="tab-page-enter">
        {tab === 'overview' && <ProjectAgreement project={project.id} onChanged={()=>void workspace.refresh()}/>}
        {tab === 'overview' ? (
          project.role === 'Customer' ? <CustomerProjectOverview project={project} progress={workspace.data?.customerProgress?.find(item => String(item.projectId) === project.id)} onNavigate={setTab}/> : <ProjectOverviewView projectId={project.id} tasks={tasks} onNavigateToTasks={openTasks} />
        ) : tab === 'tasks' ? (
          <TaskBoard
            key={filter ?? 'ALL'}
            tasks={tasks}
            role={project.role}
            archived={taskReadOnly}
            initialStatus={filter}
            onOpenCreateModal={taskReadOnly ? undefined : (deadline) => {
              setTaskDeadline(deadline);
              setModalOpen(true);
            }}
          />
        ) : tab === 'milestones' ? (
          <ProjectMilestones project={project} tasks={tasks} />
        ) : tab === 'reputation' ? (
          <ProjectReputation project={project} />
        ) : tab === 'activities' ? (
          <ProjectActivityFeed projectId={project.id} tasks={tasks} />
        ) : tab === 'resources' ? (
          <ProjectResources project={project.id} role={project.role} archived={archived || project.developmentState === 'COMPLETED'} />
        ) : tab === 'members' ? (
          <ProjectMembersView project={project} />
        ) : (
          <ProjectSettings project={project} editable={editable} canArchive={canArchiveOrReopen} pending={isArchiving} hasRunningTimer={hasRunningTimer} onEdit={() => setEditing(true)} onArchive={() => void handleArchiveToggle()} onMembers={() => setTab('members')} />
        )}
      </div>
      <EditProjectModal
        open={editing && editable}
        project={project}
        onClose={() => setEditing(false)}
        existingActiveProjectNames={projects
          .filter(
            (item) =>
              item.id !== project.id &&
              item.status === 'ACTIVE' &&
              item.role === 'Owner',
          )
          .map((item) => item.name)}
        onSubmit={(updated) => {
          showToast(`Đã cập nhật thông tin dự án "${updated.name}".`);
          setEditing(false);
        }}
      />
      <CreateTaskModal
        open={modalOpen && !taskReadOnly}
        projectId={project.id}
        role={project.role}
        initialDeadline={taskDeadline}
        onClose={() => setModalOpen(false)}
        onCreated={() => showToast('Đã tạo nhiệm vụ thành công.')}
      />
    </div>
  );
}
