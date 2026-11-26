import { useWorkspace } from '../../workspace';
import { useTaskOrganizations } from '../model/task-organization.api';
import { TaskDeadlineAlert } from './TaskDeadlineAlert';
import { useState } from 'react';
import { Pagination } from '../../../shared/ui/Pagination';
import { Badge } from '../../../shared/ui/Badge';
import { businessToday } from '../../../shared/utils/business-date';
import type { MyTaskItem, TaskPriority, TaskStatus } from '../model/task.types';
import { TaskStatusBadge } from './TaskStatusBadge';
import { PageHeader } from '../../../shared/ui/PageHeader';
import {
  getTagMeta,
  TASK_TAG_PRESETS,
  toggleTaskPin,
  usePinnedTasks,
} from '../model/task-organization';

export function MyTasksView({
  tasks,
  now,
}: {
  tasks: MyTaskItem[];
  now: number;
}) {
  const workspace=useWorkspace();
  const sharedTags=useTaskOrganizations(workspace.userId,tasks);
  const [page, setPage] = useState(0);
  const [deadlineFilter, setDeadlineFilter] = useState(
    () => new URLSearchParams(window.location.search).get('filter') ?? 'ALL',
  );
  const today = businessToday(now);
  const soon = businessToday(now + 3 * 86400000);
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(
    () =>
      ({ in_progress: 'IN_PROGRESS', awaiting_review: 'REVIEW' })[
        new URLSearchParams(window.location.search).get('status') ?? ''
      ] ?? 'ALL',
  );
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState('deadline_asc');
  const pinnedIds = usePinnedTasks(workspace.userId);

  // Filter tasks
  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.code.toLowerCase().includes(search.toLowerCase());

      const matchesProject =
        selectedProject === 'ALL' ||
        (task.projectId ?? task.projectName) === selectedProject;

      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'BLOCKED'
          ? task.isBlocked
          : task.status === selectedStatus);

      const matchesPriority =
        selectedPriority === 'ALL' || task.priority === selectedPriority;

      const matchesTag =
        selectedTag === 'ALL' || sharedTags(task).includes(selectedTag);

      const matchesPin =
        !pinnedOnly || pinnedIds.includes(String(task.id));

      const open = task.status === 'TODO' || task.status === 'IN_PROGRESS';
      const matchesDeadline =
        deadlineFilter === 'ALL' ||
        (open &&
          (deadlineFilter === 'overdue'
            ? task.deadline < today
            : task.deadline >= today && task.deadline <= soon));
      return (
        matchesDeadline &&
        matchesSearch &&
        matchesProject &&
        matchesStatus &&
        matchesPriority &&
        matchesTag &&
        matchesPin
      );
    })
    .sort((a, b) => {
      const aPinned = pinnedIds.includes(String(a.id)) ? 1 : 0;
      const bPinned = pinnedIds.includes(String(b.id)) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      if (sortOrder === 'priority_desc') {
        const rank = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return rank[b.priority] - rank[a.priority];
      }
      if (sortOrder === 'newest')
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      const deadline = (value: string) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '9999-12-31';
      return deadline(a.deadline).localeCompare(deadline(b.deadline));
    });

  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(filteredTasks.length / 20) - 1),
  );
  const handleResetFilters = () => {
    setPage(0);
    setDeadlineFilter('ALL');
    setSearch('');
    setSelectedProject('ALL');
    setSelectedStatus('ALL');
    setSelectedPriority('ALL');
    setSelectedTag('ALL');
    setPinnedOnly(false);
    setSortOrder('deadline_asc');
  };

  const isFiltered =
    deadlineFilter !== 'ALL' ||
    search !== '' ||
    selectedProject !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedTag !== 'ALL' ||
    pinnedOnly;

  return (
    <div className="my-work-page space-y-6">
      {/* 1. Header Section */}
      <PageHeader eyebrow="KHÔNG GIAN CÁ NHÂN" title="Công việc của tôi" description="Nhiệm vụ được giao cho bạn trên tất cả dự án đang tham gia." actions={<span className="inline-flex items-center rounded-xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-muted">{tasks.length} nhiệm vụ được giao</span>} />

      {/* 2. Informational Alert Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs leading-relaxed text-indigo-300">
        <svg
          className="size-4 shrink-0 text-indigo-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <span>
          Đây là một chế độ xem tổng hợp. Mỗi nhiệm vụ vẫn thuộc dự án gốc và
          tuân theo quyền của bạn trong dự án đó.
        </span>
      </div>

      {deadlineFilter !== 'ALL' && (
        <p className="text-sm text-muted">
          Đang lọc:{' '}
          {deadlineFilter === 'overdue'
            ? 'Quá hạn thực hiện'
            : 'Sắp đến hạn trong 3 ngày'}
          <button
            className="ml-3 text-accent"
            onClick={() => {
              setDeadlineFilter('ALL');
              setPage(0);
            }}
          >
            Xóa điều kiện
          </button>
        </p>
      )}
      {/* 3. Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/50 p-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Tìm tên hoặc mã nhiệm vụ..."
            className="w-full rounded-xl border border-line bg-field py-2 pr-4 pl-9 text-xs text-ink placeholder:text-muted/60 focus:border-accent focus:outline-hidden"
          />
          <svg
            className="absolute left-3 top-2.5 size-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Project Filter */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span>Dự án</span>
            <select
              aria-label="Lọc theo dự án"
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setPage(0);
              }}
              className="rounded-xl border border-line bg-field px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-hidden"
            >
              <option value="ALL">Tất cả dự án</option>
              {[
                ...new Map(
                  tasks.map((task) => [
                    task.projectId ?? task.projectName,
                    task.projectName,
                  ]),
                ).entries(),
              ].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            aria-label="Lọc theo trạng thái"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border border-line bg-field px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-hidden"
          >
            <option value="ALL">Trạng thái: Tất cả</option>
            <option value="TODO">Chưa bắt đầu</option>
            <option value="IN_PROGRESS">Đang thực hiện</option>
            <option value="REVIEW">Chờ duyệt</option>
            <option value="DONE">Hoàn thành</option>
            <option value="BLOCKED">Đang bị chặn</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          {/* Priority Filter */}
          <select
            aria-label="Lọc theo ưu tiên"
            value={selectedPriority}
            onChange={(e) => {
              setSelectedPriority(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border border-line bg-field px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-hidden"
          >
            <option value="ALL">Ưu tiên: Tất cả</option>
            <option value="HIGH">Cao</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="LOW">Thấp</option>
          </select>

          {/* Tag Filter */}
          <select
            aria-label="Lọc theo nhãn"
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value);
              setPage(0);
            }}
            className="rounded-xl border border-line bg-field px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-hidden"
          >
            <option value="ALL">Nhãn: Tất cả</option>
            {TASK_TAG_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>

          {/* Pinned Filter Toggle */}
          <button
            type="button"
            aria-pressed={pinnedOnly}
            onClick={() => {
              setPinnedOnly((v) => !v);
              setPage(0);
            }}
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
              pinnedOnly
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300'
                : 'border-line bg-field text-muted hover:text-ink'
            }`}
          >
            ★ Đã ghim ({pinnedIds.length})
          </button>

          {/* Sort Order */}
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="hidden xl:inline">Sắp xếp</span>
            <select
              aria-label="Sắp xếp nhiệm vụ"
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setPage(0);
              }}
              className="rounded-xl border border-line bg-field px-2.5 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-hidden"
            >
              <option value="deadline_asc">Deadline gần nhất</option>
              <option value="priority_desc">Ưu tiên cao nhất</option>
              <option value="newest">Mới nhất</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Results Count and Clear Filter Row */}
      <div className="flex items-center justify-between text-xs text-muted px-1">
        <span>
          Hiển thị <strong className="text-ink">{filteredTasks.length}</strong>{' '}
          trong <strong className="text-ink">{tasks.length}</strong> nhiệm vụ
        </span>
        {isFiltered && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="font-medium text-accent hover:underline"
          >
            Xóa lọc
          </button>
        )}
      </div>

      {/* 5. Tasks Table Container */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface/70 shadow-xs backdrop-blur-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-panel/40 text-muted">
                <th className="py-3.5 px-4 font-semibold sm:w-2/5">Nhiệm vụ</th>
                <th className="py-3.5 px-4 font-semibold">Dự án</th>
                <th className="py-3.5 px-4 font-semibold">Trạng thái</th>
                <th className="py-3.5 px-4 font-semibold">Ưu tiên</th>
                <th className="py-3.5 px-4 font-semibold">Deadline</th>
                <th className="py-3.5 px-3 w-8" aria-hidden="true" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredTasks.length > 0 ? (
                filteredTasks
                  .slice(safePage * 20, safePage * 20 + 20)
                  .map((task) => (
                    <tr
                      key={task.id}
                      className="group transition-colors hover:bg-surface/60"
                    >
                      {/* Column 1: Task Code & Title */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label={pinnedIds.includes(String(task.id)) ? `Bỏ ghim ${task.title}` : `Ghim ${task.title}`}
                              title={pinnedIds.includes(String(task.id)) ? 'Bỏ ghim ưu tiên' : 'Ghim nhiệm vụ lên đầu'}
                              onClick={() => toggleTaskPin(task.id,workspace.userId)}
                              className={`text-sm transition ${pinnedIds.includes(String(task.id)) ? 'text-amber-500' : 'text-muted/40 hover:text-amber-500'}`}
                            >
                              {pinnedIds.includes(String(task.id)) ? '★' : '☆'}
                            </button>
                            <span className="font-mono text-[11px] font-semibold text-muted">
                              {task.code}
                            </span>
                            {sharedTags(task).map((tagId) => {
                              const meta = getTagMeta(tagId);
                              return <Badge key={tagId} tone={meta.tone}>{meta.label}</Badge>;
                            })}
                          </div>
                          <p className="mt-0.5 font-semibold text-ink transition-colors group-hover:text-accent">
                            {task.title}
                          </p>
                        </div>
                      </td>

                      {/* Column 2: Project */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-md font-bold text-[10px] ${task.projectTone}`}
                          >
                            {task.projectCode}
                          </span>
                          <span className="truncate text-ink font-medium">
                            {task.projectName}
                          </span>
                        </div>
                      </td>

                      {/* Column 3: Status */}
                      <td className="py-3.5 px-4">
                        <TaskStatusBadge status={task.status as TaskStatus} /><div className="mt-2"><TaskDeadlineAlert task={task} now={now} /></div>
                        {task.isBlocked && (
                          <span className="ml-2 text-xs text-danger">
                            Đang bị chặn
                          </span>
                        )}
                      </td>

                      {/* Column 4: Priority */}
                      <td className="py-3.5 px-4">
                        <PriorityDisplay priority={task.priority} />
                      </td>

                      {/* Column 5: Deadline */}
                      <td className="py-3.5 px-4 text-muted whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <svg
                            className="size-3.5 shrink-0 text-muted"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6.75 3v2.25M17.25 3v2.253 3.75m3 0a1.5 1.5 0 011.5 1.5v11.25a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5V8.25m15 0H3.75"
                            />
                          </svg>
                          <span>{task.deadline}</span>
                        </div>
                      </td>

                      {/* Column 6: Right Chevron */}
                      <td className="py-3.5 px-3 text-right text-muted group-hover:text-ink">
                        <a
                          href={`/tasks/${encodeURIComponent(task.id)}`}
                          aria-label={`Mở nhiệm vụ ${task.title}`}
                          className="inline-flex rounded-lg p-1 hover:bg-panel focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <svg
                            className="size-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M8.25 4.5l7.5 7.5-7.5 7.5"
                            />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={safePage}
          total={filteredTasks.length}
          onChange={setPage}
        />
      </div>
    </div>
  );
}

function PriorityDisplay({ priority }: { priority: TaskPriority }) {
  switch (priority) {
    case 'HIGH':
      return <span className="font-semibold text-rose-500">Cao</span>;
    case 'MEDIUM':
      return <span className="font-semibold text-amber-500">Trung bình</span>;
    case 'LOW':
      return <span className="font-medium text-muted">Thấp</span>;
    case 'URGENT':
      return <span className="font-bold text-rose-600">Khẩn cấp</span>;
  }
}
