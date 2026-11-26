import { AccountName } from '../../profile/components/AccountName';
import { TaskDeadlineAlert } from './TaskDeadlineAlert';
import { useState, type ReactNode } from 'react';
import { Pagination } from '../../../shared/ui/Pagination';
import { UserAvatar } from '../../profile/components/UserAvatar';
import type { Task } from '../model/task.types';
import { TaskPriorityBadge, TaskStatusBadge } from './TaskStatusBadge';

export interface TaskTableProps {
  tasks: Task[];
  onOpenCreateModal?: () => void;
  initialStatus?: string;
  hideToolbar?: boolean;
  renderActions?: (task: Task) => ReactNode;
}

export function TaskTable({
  tasks,
  onOpenCreateModal,
  initialStatus = 'ALL',
  hideToolbar = false,
  renderActions,
}: TaskTableProps) {
  const [page, setPage] = useState(0);
  const [size,setSize] = useState(20);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus);

  const filteredTasks = tasks.filter((task) => {
    if (hideToolbar) return true;
    const matchesSearch =
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'BLOCKED'
        ? task.isBlocked
        : task.status === filterStatus);
    return matchesSearch && matchesStatus;
  });

  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(filteredTasks.length / size) - 1),
  );
  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      {!hideToolbar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left search */}
          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              aria-label="Tìm nhiệm vụ"
              placeholder="Tìm theo tên hoặc mã..."
              className="w-full rounded-xl border border-line bg-surface py-2 pr-4 pl-9 text-xs text-ink placeholder:text-muted/60 focus:border-accent focus:outline-hidden"
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

          {/* Right filter controls and create button */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc trạng thái nhiệm vụ"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(0);
              }}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-muted focus:border-accent focus:outline-hidden"
            >
              <option value="ALL">Trạng thái: Tất cả</option>
              <option value="TODO">Chưa bắt đầu</option>
              <option value="IN_PROGRESS">Đang thực hiện</option>
              <option value="REVIEW">Chờ duyệt</option>
              <option value="DONE">Hoàn thành</option>
              <option value="BLOCKED">Đang bị chặn</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>

            {onOpenCreateModal && (
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-on-accent shadow-xs transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
              >
                <svg
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Tạo nhiệm vụ
              </button>
            )}
          </div>
        </div>
      )}
      {/* Task List Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface/70 shadow-xs backdrop-blur-xs">
        <div className="overflow-x-auto">
          <table className="task-list-table">
            <thead>
              <tr className="border-b border-line bg-panel/50 text-muted">
                <th className="py-3 px-4 font-semibold">Nhiệm vụ</th>
                <th className="py-3 px-4 font-semibold">Người phụ trách</th>
                <th className="py-3 px-4 font-semibold">Ưu tiên</th>
                <th className="py-3 px-4 font-semibold">Trạng thái</th>
                <th className="py-3 px-4 font-semibold">Deadline</th>
                <th className="py-3 px-4 font-semibold">Ước tính</th>
                {renderActions && (
                  <th className="py-3 px-4 font-semibold">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {filteredTasks.length > 0 ? (
                filteredTasks
                  .slice(safePage * size, safePage * size + size)
                  .map((task) => (
                    <tr
                      key={task.id}
                      className="group transition-colors hover:bg-surface/50"
                    >
                      {/* Task Title & Code */}
                      <td className="py-3 px-4">
                        <div className="grid gap-1.5">
                          <span className="text-[11px] text-muted">
                            {task.code}
                          </span>
                          <a
                            href={`/tasks/${task.id}`}
                            className="font-semibold text-ink group-hover:text-accent"
                          >
                            {task.title}
                          </a>
                        </div>
                      </td>

                      {/* Assignee */}
                      <td className="py-3 px-4 text-ink/90">
                        <div className="flex items-center gap-2">
                          <UserAvatar userId={task.assignee.id} projectId={task.projectId} name={task.assignee.name} className="size-6" />
                          <AccountName userId={task.assignee.id} name={task.assignee.name} />
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <TaskPriorityBadge priority={task.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <TaskStatusBadge status={task.status} />
                        {task.isBlocked && (
                          <span className="ml-2 text-xs text-danger">
                            Đang bị chặn
                          </span>
                        )}
                      </td>

                      {/* Deadline */}
                      <td className="py-3 px-4 text-muted">
                        <div className="space-y-2"><span>{task.deadline || '—'}</span><TaskDeadlineAlert task={task} /></div>
                      </td>

                      {/* Estimated Hours */}
                      <td className="py-3 px-4 text-muted">
                        <span className="font-medium text-ink">
                          {task.estimatedHours}h
                        </span>
                        {task.spentHours !== undefined && (
                          <span className="text-[11px] text-muted">
                            {' '}
                            / {task.spentHours}h
                          </span>
                        )}
                      </td>
                      {renderActions && (
                        <td className="py-3 px-4">{renderActions(task)}</td>
                      )}
                    </tr>
                  ))
              ) : (
                <tr>
                  <td
                    colSpan={renderActions ? 7 : 6}
                    className="py-8 text-center text-muted"
                  >
                    Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <label className="px-4 text-xs text-muted">Số kết quả mỗi trang <select value={size} onChange={e=>{setSize(Number(e.target.value));setPage(0);}} className="rounded border border-line bg-field p-1">{[10,20,50].map(size=><option key={size} value={size}>{size}</option>)}</select></label>
        <Pagination
          size={size}
          page={safePage}
          total={filteredTasks.length}
          onChange={setPage}
        />
      </div>
    </div>
  );
}
