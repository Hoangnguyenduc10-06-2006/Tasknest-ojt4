import { useMemo, useState } from 'react';
import { useSession } from '../../auth';
import { useWorkspace } from '../../workspace';
import { Pagination } from '../../../shared/ui/Pagination';
import { useProjects } from '../hooks/useProjects';
import {
  archiveStoredProject,
  createStoredProject,
  loadProjects,
  reopenStoredProject,
} from '../model/project.store';
import type {
  CreateProjectInput,
  MyProjectItem,
  ProjectRole,
  ProjectStatus,
  UpdateProjectInput,
} from '../model/project.types';
import {
  canEditProject,
  hasRunningTimerInProject,
  validateProjectArchiveAction,
} from '../model/project.validation';
import { ProjectCard } from './ProjectCard';
import { CreateProjectModal } from './modals/CreateProjectModal';
import { EditProjectModal } from './modals/EditProjectModal';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Button } from '../../../shared/ui/Button';

export function MyProjectsView({
  progressByProject = {},
}: {
  progressByProject?: Record<string, number>;
}) {
  const session = useSession();
  const storedProjects = useProjects();
  const workspace = useWorkspace();
  const projects = useMemo(
    () =>
      storedProjects.map((project) => ({
        ...project,
        progress: progressByProject[project.id] ?? 0,
        taskCount: workspace.data?.tasks.filter(
          (task) =>
            task.projectId === project.id && task.status !== 'CANCELLED',
        ).length,
      })),
    [storedProjects, progressByProject, workspace.data],
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectStatus | 'COMPLETED'>(
    'ALL',
  );
  const [roleFilter, setRoleFilter] = useState<'ALL' | ProjectRole>('ALL');
  const [sortOrder, setSortOrder] = useState<
    'updated_recent' | 'created_recent' | 'progress_desc' | 'name_asc' | 'name_desc'
  >('updated_recent');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<MyProjectItem | null>(
    null,
  );
  const [archivingProjectId, setArchivingProjectId] = useState<string | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3200);
  };

  const activeCount = useMemo(
    () => projects.filter(p => p.status === 'ACTIVE' && p.developmentState !== 'COMPLETED').length,
    [projects],
  );
  const archivedCount = useMemo(
    () => projects.filter((p) => p.status === 'ARCHIVED').length,
    [projects],
  );

  const completedCount = projects.filter(p => p.status === 'ACTIVE' && p.developmentState === 'COMPLETED').length;

  const existingActiveNames = useMemo(
    () =>
      projects
        .filter((p) => p.status === 'ACTIVE' && p.role === 'Owner')
        .map((p) => p.name),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.code.toLowerCase().includes(query);
        const matchesStatus =
          statusFilter === 'ALL' || (p.status === 'ACTIVE' && p.developmentState === 'COMPLETED' ? 'COMPLETED' : p.status) === statusFilter;
        const matchesRole = roleFilter === 'ALL' || p.role === roleFilter;
        return matchesSearch && matchesStatus && matchesRole;
      })
      .sort((a, b) => {
        if (sortOrder === 'created_recent') return (b.createdAtMs??0)-(a.createdAtMs??0);
        if (sortOrder === 'progress_desc') return b.progress - a.progress;
        if (sortOrder === 'name_asc') return a.name.localeCompare(b.name, 'vi');
        if (sortOrder === 'name_desc')
          return b.name.localeCompare(a.name, 'vi');
        return b.updatedAtMs - a.updatedAtMs;
      });
  }, [projects, search, statusFilter, roleFilter, sortOrder]);

  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filteredProjects.length / size) - 1),
  );
  const visibleProjects = filteredProjects.slice(
    currentPage * size,
    (currentPage + 1) * size,
  );

  const handleCreateProject = async (input: CreateProjectInput) => {
    if (session.status !== 'authenticated')
      throw new Error('Vui lòng đăng nhập lại.');
    const result = await createStoredProject(session.user.id, input);
    setPage(0);
    showToast(`Đã tạo dự án "${result.name}" thành công.`);
  };

  const handleEditProject = (updated: UpdateProjectInput) => {
    showToast(`Đã cập nhật thông tin dự án "${updated.name}".`);
  };

  const handleArchiveToggle = async (project: MyProjectItem) => {
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
    setArchivingProjectId(project.id);
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
      setArchivingProjectId(null);
    }
  };

  return (
    <div className="my-projects-page space-y-6">
      {/* Toast Notification */}
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

      <PageHeader eyebrow="KHÔNG GIAN CÁ NHÂN" title="Dự án của tôi" description="Những dự án bạn đang sở hữu hoặc tham gia." actions={<Button onClick={() => setIsCreateModalOpen(true)}>Tạo dự án</Button>} />

      {/* 2. Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-3 backdrop-blur-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Tìm tên dự án..."
            aria-label="Tìm tên dự án"
            className="w-full rounded-xl border border-line bg-field py-2 pr-4 pl-9 text-xs text-ink placeholder:text-muted/60 transition focus:border-accent focus:outline-hidden"
          />
          <svg
            className="absolute left-3 top-2.5 size-4 text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(0);
              }}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute right-2.5 top-2 size-4 text-muted hover:text-ink"
            >
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Right filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter with icon */}
          <div className="relative flex items-center">
            <label htmlFor="project-status-filter" className="sr-only">
              Lọc theo trạng thái
            </label>
            <div className="flex items-center gap-1.5 rounded-xl border border-line bg-field px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent/40">
              <svg
                className="size-3.5 text-muted shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
                />
              </svg>
              <span className="text-muted">Trạng thái:</span>
              <select
                id="project-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'ALL' | ProjectStatus | 'COMPLETED');
                  setPage(0);
                }}
                className="bg-transparent font-medium text-ink cursor-pointer focus:outline-hidden"
              >
                <option value="ALL">Tất cả</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="COMPLETED">Đã hoàn thành</option>
                <option value="ARCHIVED">Đã lưu trữ</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-line bg-field px-3 py-1.5 text-xs text-muted">
            Vai trò
            <select
              aria-label="Lọc theo vai trò"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value as 'ALL' | ProjectRole);
                setPage(0);
              }}
              className="bg-transparent font-medium text-ink"
            >
              <option value="ALL">Tất cả</option>
              <option value="Owner">Chủ dự án</option>
              <option value="Manager">Quản lý</option>
              <option value="Member">Thành viên</option>
              <option value="Customer">Khách hàng</option>
            </select>
          </label>
          {/* Sort order */}
          <div className="relative flex items-center">
            <label htmlFor="project-sort-order" className="sr-only">
              Sắp xếp dự án
            </label>
            <div className="flex items-center gap-1.5 rounded-xl border border-line bg-field px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent/40">
              <select
                id="project-sort-order"
                value={sortOrder}
                onChange={(e) => {
                  setPage(0);
                  setSortOrder(
                    e.target.value as
                      | 'updated_recent'
                      | 'created_recent'
                      | 'progress_desc'
                      | 'name_asc'
                      | 'name_desc',
                  );
                }}
                className="bg-transparent font-medium text-ink cursor-pointer focus:outline-hidden"
              >
                <option value="updated_recent">Cập nhật gần nhất</option>
                <option value="created_recent">Tạo gần nhất</option>
                <option value="progress_desc">Tiến độ cao nhất</option>
                <option value="name_asc">Tên A-Z</option>
                <option value="name_desc">Tên Z-A</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sub-bar summary count */}
      <div className="flex items-center justify-between text-xs text-muted px-1">
        <span>{filteredProjects.length} dự án</span>
        <span>
          {activeCount} đang hoạt động · {completedCount} đã hoàn thành · {archivedCount} đã lưu trữ
        </span>
      </div>

      {/* 4. Project Cards Grid */}
      {filteredProjects.length > 0 ? (
        <>
          <div className="project-catalog">
            {visibleProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                hasRunningTimer={hasRunningTimerInProject(
                  project.id,
                  workspace.data?.timeEntries,
                )}
                isArchiving={archivingProjectId === project.id}
                onArchiveToggle={() => void handleArchiveToggle(project)}
                onEdit={
                  canEditProject(project)
                    ? (p) => setEditingProject(p)
                    : undefined
                }
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <label className="flex items-center gap-2 text-xs text-muted">
              Số kết quả mỗi trang
              <select
                value={size}
                onChange={(event) => {
                  setSize(Number(event.target.value));
                  setPage(0);
                }}
                className="rounded-lg border border-line bg-field px-3 py-2 text-ink"
              >
                {[10, 20, 50].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <Pagination
              page={currentPage}
              total={filteredProjects.length}
              size={size}
              onChange={setPage}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface/50 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-line bg-field text-muted">
            <svg
              className="size-7"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-sm font-semibold text-ink">
            Không tìm thấy dự án nào
          </h3>
          <p className="mt-1 text-xs text-muted max-w-sm">
            {projects.length === 0
              ? 'Bạn chưa tham gia dự án nào. Tạo dự án để bắt đầu.'
              : 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.'}
          </p>
          {(search || statusFilter !== 'ALL' || roleFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setRoleFilter('ALL');
                setPage(0);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      )}

      {/* 5. Create Project Modal */}
      <CreateProjectModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateProject}
        existingActiveProjectNames={existingActiveNames}
      />

      {/* 6. Edit Project Modal */}
      <EditProjectModal
        open={Boolean(editingProject)}
        project={
          editingProject
            ? (projects.find((p) => p.id === editingProject.id) ??
              editingProject)
            : null
        }
        onClose={() => setEditingProject(null)}
        onSubmit={handleEditProject}
        existingActiveProjectNames={existingActiveNames}
      />
    </div>
  );
}
