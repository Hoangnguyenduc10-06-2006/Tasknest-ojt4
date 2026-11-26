import { TaskFilters } from './TaskFilters';
import { Icon } from '../../../shared/ui/Icon';
import { KanbanTaskContent } from './KanbanTaskContent';
import { useEffect, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { businessToday } from '../../../shared/utils/business-date';
import { useWorkspace } from '../../workspace';
import {
  availableTransitions,
  filterBoardTasks,
  statusLabels,
  taskColumns,
  type BoardFilters,
} from '../model/task-board';
import type { Task, TaskStatus } from '../model/task.types';
import { TaskTable } from './TaskTable';
import { TaskTransitionModal } from './modals/TaskTransitionModal';
import { TaskCalendarView } from './TaskCalendarView';

export interface TaskBoardProps {
  tasks: Task[];
  role: 'Owner' | 'Manager' | 'Member' | 'Customer';
  archived: boolean;
  initialStatus?: TaskStatus | 'ALL';
  onOpenCreateModal?: (deadline?: string) => void;
}
export function TaskBoard({
  tasks,
  role,
  archived,
  initialStatus = 'ALL',
  onOpenCreateModal,
}: TaskBoardProps) {
  const { userId } = useWorkspace();
  const [view, setView] = useState<'kanban' | 'list' | 'calendar'>(
    initialStatus === 'CANCELLED' ? 'list' : 'kanban',
  );
  const [filters, setFilters] = useState<BoardFilters>({
    search: '',
    assignee: 'ALL',
    status: initialStatus,
    priority: 'ALL',
    todayOnly: false,
    fromDate: '', toDate: '', alert: 'ALL', sort: 'DEADLINE',
  });
  const [dragged, setDragged] = useState<string>();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ task: Task; target: TaskStatus }>();
  const [today, setToday] = useState(() => businessToday(Date.now()));
  useEffect(() => {
    const timer = window.setInterval(
      () => setToday(businessToday(Date.now())),
      60000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const filtered = filterBoardTasks(tasks, filters, today);
  const assignees = [
    ...new Map(tasks.map((task) => [task.assignee.id, task.assignee])).values(),
  ];
  const choices = (task: Task) =>
    availableTransitions(task, userId, role, archived);
  const requestTransition = (task: Task, target: TaskStatus) => {
    if (!choices(task).includes(target)) {
      setMessage(
        'Không thể chuyển sang cột này. Hãy kiểm tra quyền và luồng trạng thái của nhiệm vụ.',
      );
      return;
    }
    setMessage('');
    setPending({ task, target });
  };
  const changeFilter = (patch: Partial<BoardFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    if (patch.status === 'CANCELLED') setView('list');
    setMessage('');
  };
  const actions = (task: Task) => {
    const targets = choices(task);
    return (
      targets.length > 0 && (
        <select
          aria-label={`Đổi trạng thái ${task.code}`}
          value=""
          disabled={!!pending}
          onChange={(event) =>
            requestTransition(task, event.target.value as TaskStatus)
          }
          className="max-w-full rounded-lg border border-line bg-field p-2 text-xs text-ink"
        >
          <option value="" disabled>
            Chuyển trạng thái...
          </option>
          {targets.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </select>
      )
    );
  };
  return (
    <section className="space-y-4" aria-label="Bảng nhiệm vụ">
      <div className="tasks-toolbar !mt-0"><div><h2>Nhiệm vụ</h2><p>{tasks.length} nhiệm vụ trong dự án</p></div>{onOpenCreateModal && !archived && <Button icon="plus" size="sm" onClick={() => onOpenCreateModal()}>Tạo nhiệm vụ</Button>}</div>
      <TaskFilters filters={filters} assignees={assignees} onChange={changeFilter} view={view}
        onReset={() => { setFilters({search:'',assignee:'ALL',status:'ALL',priority:'ALL',todayOnly:false,fromDate:'',toDate:'',alert:'ALL',sort:'DEADLINE'}); setMessage(''); }}
        onView={mode => { if (mode !== 'list' && filters.status === 'CANCELLED') { setMessage(`Nhiệm vụ đã hủy chỉ hiển thị trong Danh sách. Xóa bộ lọc Đã hủy để mở ${mode === 'kanban' ? 'Kanban' : 'Lịch'}.`); return; } setView(mode); setMessage(''); }} />
      {message && (
        <div
          role="status"
          className="rounded-xl border border-line bg-panel p-3 text-sm"
        >
          {message}
          {filters.status === 'CANCELLED' && (
            <button
              type="button"
              onClick={() => {
                changeFilter({ status: 'ALL' });
                setView('kanban');
              }}
              className="ml-3 font-semibold text-accent"
            >
              Xóa bộ lọc Đã hủy và mở Kanban
            </button>
          )}
        </div>
      )}
      {!!filters.fromDate && !!filters.toDate && filters.fromDate>filters.toDate && <p role="alert" className="text-sm text-danger">Ngày kết thúc bộ lọc không được trước ngày bắt đầu.</p>}
      <p className="text-xs text-muted">
        {view === 'list'
          ? filtered.length
          : filtered.filter((task) => task.status !== 'CANCELLED').length}{' '}
        / {tasks.length} nhiệm vụ
        {view !== 'list' ? ' · Nhiệm vụ đã hủy xem trong Danh sách.' : ''}
        {archived ? ' · Dự án chỉ được xem.' : ''}
      </p>
      {view === 'list' ? (
        <TaskTable tasks={filtered} hideToolbar renderActions={actions} />
      ) : view === 'calendar' ? (
        <TaskCalendarView
          tasks={filtered}
          onOpenCreateModal={archived ? undefined : onOpenCreateModal}
          renderActions={actions}
        />
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="kanban">
            {taskColumns.map((column) => {
              const items = filtered.filter(
                (task) => task.status === column.status,
              );
              const source = tasks.find((task) => task.id === dragged);
              const canDrop =
                !!source && !pending && choices(source).includes(column.status);
              return (
                <section
                  key={column.status}
                  aria-label={column.label}
                  onDragOver={(event) => {
                    if (canDrop) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (
                      source &&
                      event.dataTransfer.getData('text/plain') === source.id &&
                      !pending
                    )
                      requestTransition(source, column.status);
                    setDragged(undefined);
                  }}
                  className={`kanban-column ${canDrop ? '!border-accent !bg-tint' : ''}`}
                >
                  <header className="column-head">
                    <span className={`status-dot ${column.status === 'IN_PROGRESS' ? 'blue' : column.status === 'REVIEW' ? 'purple' : column.status === 'DONE' ? 'green' : ''}`} aria-hidden="true" />
                    <h3 className="text-sm font-semibold">{column.label}</h3>
                    <span className="rounded-lg bg-surface px-2 py-1 text-xs text-muted">
                      {items.length}
                    </span>
                  </header>
                  <div className="column-body">
                    {items.map((task) => (
                      <article
                        key={task.id}
                        draggable={
                          !pending &&
                          choices(task).some((status) => status !== 'CANCELLED')
                        }
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', task.id);
                          event.dataTransfer.effectAllowed = 'move';
                          setDragged(task.id);
                        }}
                        onDragEnd={() => setDragged(undefined)}
                        className={`task-card ${dragged === task.id ? 'opacity-50' : ''}`}
                      >
                        <KanbanTaskContent task={task} actions={choices(task).length ? actions(task) : undefined} />
                      </article>
                    ))}
                    {!items.length && (
                      <p className="kanban-empty">
                        Chưa có nhiệm vụ trong cột này
                      </p>
                    )}
                    {!archived && onOpenCreateModal && column.status === 'TODO' && (
                      <button type="button" className="add-task" onClick={() => onOpenCreateModal()}>
                        <Icon name="plus" size={16} />Thêm nhiệm vụ
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
      {pending && (
        <TaskTransitionModal
          key={`${pending.task.id}-${pending.task.version}-${pending.target}`}
          task={pending.task}
          target={pending.target}
          onClose={() => setPending(undefined)}
        />
      )}
    </section>
  );
}
