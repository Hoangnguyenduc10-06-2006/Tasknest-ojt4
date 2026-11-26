import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Task, TaskPriority, TaskStatus } from '../model/task.types';
import { Icon } from '../../../shared/ui/Icon';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { TaskPriorityBadge, TaskStatusBadge } from './TaskStatusBadge';
import { UserAvatar as Avatar } from '../../profile/components/UserAvatar';
import { AccountName } from '../../profile/components/AccountName';
import { businessToday } from '../../../shared/utils/business-date';

export interface TaskCalendarViewProps {
  tasks: Task[];
  onOpenCreateModal?: (deadline: string) => void;
  renderActions?: (task: Task) => React.ReactNode;
}

const WEEKDAYS = [
  { short: 'T2', full: 'Thứ Hai' },
  { short: 'T3', full: 'Thứ Ba' },
  { short: 'T4', full: 'Thứ Tư' },
  { short: 'T5', full: 'Thứ Năm' },
  { short: 'T6', full: 'Thứ Sáu' },
  { short: 'T7', full: 'Thứ Bảy' },
  { short: 'CN', full: 'Chủ Nhật' },
];

const priorityPillClasses: Record<TaskPriority, string> = {
  URGENT: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/25',
  HIGH: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25',
  MEDIUM: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25',
  LOW: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30 hover:bg-slate-500/25',
};

const statusDotColors: Record<TaskStatus, string> = {
  TODO: 'bg-slate-400',
  IN_PROGRESS: 'bg-blue-500',
  REVIEW: 'bg-purple-500',
  DONE: 'bg-emerald-500',
  BLOCKED: 'bg-red-500',
  CANCELLED: 'bg-slate-400 line-through',
};

function formatIsoDate(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function CalendarTaskLink({ task, className, children }: {
  task: Task;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const previewId = useId();
  const link = useRef<HTMLAnchorElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number>(undefined);

  function showPreview() {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function scheduleClose() {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      if (!link.current?.matches(':hover, :focus-visible') && !preview.current?.matches(':hover')) {
        setOpen(false);
      }
    }, 120);
  }

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useLayoutEffect(() => {
    if (!open || !link.current || !preview.current) return;
    const anchor = link.current.getBoundingClientRect();
    const card = preview.current;
    const { offsetWidth: width, offsetHeight: height } = card;
    const margin = 8;
    const gap = 5;
    const right = anchor.right + gap;
    const left = anchor.left - gap - width;
    const fitsRight = right + width <= window.innerWidth - margin;
    const fitsLeft = left >= margin;
    const x = fitsRight ? right : fitsLeft ? left : anchor.left;
    const below = anchor.bottom + gap;
    const y = fitsRight || fitsLeft ? anchor.top : below + height <= window.innerHeight - margin
      ? below : anchor.top - gap - height;
    card.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - width - margin))}px`;
    card.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - height - margin))}px`;

    const close = () => setOpen(false);
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && card.contains(event.target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <a
        ref={link}
        href={`/tasks/${task.id}`}
        className={className}
        aria-describedby={open ? previewId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'touch') return;
          showPreview();
        }}
        onPointerLeave={scheduleClose}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) showPreview();
        }}
        onBlur={scheduleClose}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(false);
        }}
      >
        {children}
      </a>
      {open && createPortal(
        <div
          ref={preview}
          id={previewId}
          role="tooltip"
          className="fixed z-50 max-h-[calc(100dvh-1rem)] w-[min(20rem,calc(100vw-1rem))] space-y-2.5 overflow-auto rounded-xl border border-line bg-surface p-3 text-xs text-ink shadow-xl"
          onPointerEnter={() => window.clearTimeout(closeTimer.current)}
          onPointerLeave={scheduleClose}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="font-semibold text-accent">{task.code}</p>
          <p className="text-sm font-bold wrap-break-word">{task.title}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <TaskStatusBadge status={task.isBlocked ? 'BLOCKED' : task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          {task.description.trim() && (
            <p className="line-clamp-3 whitespace-pre-line wrap-break-word text-muted">{task.description}</p>
          )}
          <dl className="space-y-1.5 border-t border-line pt-2">
            <div className="flex items-start justify-between gap-3">
              <dt className="shrink-0 text-muted">Người phụ trách</dt>
              <dd className="text-right wrap-break-word">{task.assignee.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Hạn chót</dt>
              <dd>{task.deadline ? formatDisplayDate(task.deadline) : 'Chưa đặt'}</dd>
            </div>
          </dl>
        </div>,
        document.body,
      )}
    </>
  );
}

export function TaskCalendarView({ tasks, onOpenCreateModal, renderActions }: TaskCalendarViewProps) {
  const [today] = useState(() => businessToday(Date.now()));
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [selectedDayTasks, setSelectedDayTasks] = useState<{ date: string; tasks: Task[] } | null>(null);
  const [showUnscheduled, setShowUnscheduled] = useState(false);

  // Group tasks by deadline (YYYY-MM-DD)
  const { tasksByDate, unscheduledTasks } = useMemo(() => {
    const map = new Map<string, Task[]>();
    const unscheduled: Task[] = [];

    for (const task of tasks) {
      if (task.status === 'CANCELLED') continue; // Hide cancelled tasks in calendar view
      if (task.deadline && /^\d{4}-\d{2}-\d{2}$/.test(task.deadline)) {
        const list = map.get(task.deadline) ?? [];
        list.push(task);
        map.set(task.deadline, list);
      } else {
        unscheduled.push(task);
      }
    }

    return { tasksByDate: map, unscheduledTasks: unscheduled };
  }, [tasks]);

  // Navigate months
  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Build grid calendar cells for current month
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    // Day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const rawDayOfWeek = firstDayOfMonth.getDay();
    // Monday-first index: 0 = Mon, ..., 6 = Sun
    const mondayFirstCol = rawDayOfWeek === 0 ? 6 : rawDayOfWeek - 1;

    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    interface CalendarCell {
      key: string;
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      tasks: Task[];
    }

    const cells: CalendarCell[] = [];

    // 1. Trailing days from previous month
    for (let i = mondayFirstCol - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
      const dateStr = formatIsoDate(prevMonthYear, prevMonthIdx, dayNum);
      cells.push({
        key: `prev-${dateStr}`,
        dateString: dateStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateStr === today,
        tasks: tasksByDate.get(dateStr) ?? [],
      });
    }

    // 2. Days in current month
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const dateStr = formatIsoDate(currentYear, currentMonth, dayNum);
      cells.push({
        key: `curr-${dateStr}`,
        dateString: dateStr,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dateStr === today,
        tasks: tasksByDate.get(dateStr) ?? [],
      });
    }

    // 3. Leading days for next month to complete the 7-column grid
    const totalFilled = cells.length;
    const remainingToMultipleOf7 = (7 - (totalFilled % 7)) % 7;
    for (let i = 1; i <= remainingToMultipleOf7; i++) {
      const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
      const dateStr = formatIsoDate(nextMonthYear, nextMonthIdx, i);
      cells.push({
        key: `next-${dateStr}`,
        dateString: dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === today,
        tasks: tasksByDate.get(dateStr) ?? [],
      });
    }

    return cells;
  }, [currentYear, currentMonth, tasksByDate, today]);

  // Statistics for this month
  const monthStats = useMemo(() => {
    let totalInMonth = 0;
    let completedInMonth = 0;
    let overdueInMonth = 0;

    for (const cell of calendarDays) {
      if (!cell.isCurrentMonth) continue;
      for (const t of cell.tasks) {
        totalInMonth++;
        if (t.status === 'DONE') {
          completedInMonth++;
        } else if (cell.dateString < today) {
          overdueInMonth++;
        }
      }
    }

    return { totalInMonth, completedInMonth, overdueInMonth };
  }, [calendarDays, today]);

  return (
    <div className="space-y-4">
      {/* 1. Calendar Navigation & Stats Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        {/* Month Picker / Navigator */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="flex size-9 items-center justify-center rounded-lg border border-line bg-field text-ink transition hover:border-accent hover:text-accent"
            title="Tháng trước"
            aria-label="Tháng trước"
          >
            <span className="text-base font-bold leading-none">‹</span>
          </button>

          <h3 className="min-w-40 text-center text-base font-bold text-ink">
            Tháng {currentMonth + 1}, {currentYear}
          </h3>

          <button
            type="button"
            onClick={goToNextMonth}
            className="flex size-9 items-center justify-center rounded-lg border border-line bg-field text-ink transition hover:border-accent hover:text-accent"
            title="Tháng sau"
            aria-label="Tháng sau"
          >
            <span className="text-base font-bold leading-none">›</span>
          </button>

          <button
            type="button"
            onClick={goToToday}
            className="ml-2 rounded-lg border border-line bg-field px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
          >
            Hôm nay
          </button>
        </div>

        {/* Month Summary Counters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg bg-panel px-3 py-1.5 font-medium text-ink">
            <span className="text-muted">Tổng hạn trong tháng:</span>
            <strong className="text-ink">{monthStats.totalInMonth}</strong>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span>Đã hoàn thành:</span>
            <strong>{monthStats.completedInMonth}</strong>
          </div>
          {monthStats.overdueInMonth > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 font-medium text-red-600 dark:text-red-400">
              <Icon name="alert" size={13} />
              <span>Quá hạn:</span>
              <strong>{monthStats.overdueInMonth}</strong>
            </div>
          )}
        </div>
      </div>

      {/* 2. Main 7-Column Calendar Grid */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
        <div className="min-w-[760px]">
          {/* Weekday Labels Header */}
          <div className="grid grid-cols-7 border-b border-line bg-panel text-center text-xs font-semibold text-muted">
            {WEEKDAYS.map((day) => (
              <div key={day.short} className="py-2.5">
                <span className="hidden sm:inline">{day.full}</span>
                <span className="sm:hidden">{day.short}</span>
              </div>
            ))}
          </div>

          {/* Days Grid Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-line">
            {calendarDays.map((cell) => {
              const hasTasks = cell.tasks.length > 0;
              const isOverdueDay = cell.dateString < today;

              return (
                <div
                  key={cell.key}
                  onClick={() => {
                    if (hasTasks) {
                      setSelectedDayTasks({ date: cell.dateString, tasks: cell.tasks });
                    }
                  }}
                  className={`group relative flex min-h-[110px] flex-col p-2 transition md:min-h-[125px] ${
                    cell.isCurrentMonth ? 'bg-surface' : 'bg-canvas/50 text-muted/60'
                  } ${cell.isToday ? 'bg-accent/5 ring-1 ring-accent/30' : ''} ${
                    hasTasks ? 'cursor-pointer hover:bg-panel/60' : ''
                  }`}
                >
                  {/* Cell Top Header (Day Number & Create Button) */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                        cell.isToday
                          ? 'bg-accent text-white shadow-xs'
                          : cell.isCurrentMonth
                            ? 'text-ink'
                            : 'text-muted/50'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Quick Add Task button for this day */}
                    {onOpenCreateModal && cell.isCurrentMonth && cell.dateString >= today && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCreateModal(cell.dateString);
                        }}
                        className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-accent"
                        title={`Tạo nhiệm vụ đến hạn ngày ${formatDisplayDate(cell.dateString)}`}
                        aria-label={`Tạo nhiệm vụ đến hạn ngày ${formatDisplayDate(cell.dateString)}`}
                      >
                        <Icon name="plus" size={13} />
                      </button>
                    )}
                  </div>

                  {/* Task Pills in Day Cell */}
                  <div className="mt-1.5 flex flex-1 flex-col gap-1 overflow-hidden">
                    {cell.tasks.slice(0, 3).map((task) => {
                      const isTaskDone = task.status === 'DONE';
                      const isTaskOverdue = !isTaskDone && isOverdueDay;

                      return (
                        <CalendarTaskLink
                          key={task.id}
                          task={task}
                          className={`flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-tight transition ${
                            priorityPillClasses[task.priority]
                          } ${isTaskDone ? 'opacity-60 line-through' : ''}`}
                        >
                          <span
                            className={`size-1.5 shrink-0 rounded-full ${
                              isTaskOverdue ? 'bg-red-500' : statusDotColors[task.status]
                            }`}
                          />
                          <span className="font-semibold shrink-0">{task.code}</span>
                          <span className="truncate">{task.title}</span>
                        </CalendarTaskLink>
                      );
                    })}

                    {/* More tasks indicator */}
                    {cell.tasks.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayTasks({ date: cell.dateString, tasks: cell.tasks });
                        }}
                        className="mt-auto text-left text-[11px] font-semibold text-accent hover:underline"
                      >
                        +{cell.tasks.length - 3} việc khác
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Unscheduled Tasks Collapsible (No Deadline) */}
      {unscheduledTasks.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="calendar" size={18} />
              <h4 className="text-sm font-semibold text-ink">
                Nhiệm vụ chưa đặt deadline ({unscheduledTasks.length})
              </h4>
              <span className="text-xs text-muted">Cần xếp hạn để hiển thị trên lịch</span>
            </div>
            <button
              type="button"
              onClick={() => setShowUnscheduled((prev) => !prev)}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {showUnscheduled ? 'Thu gọn' : 'Xem danh sách'}
            </button>
          </div>

          {showUnscheduled && (
            <div className="mt-3 divide-y divide-line border-t border-line pt-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unscheduledTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-line bg-panel p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-accent">{task.code}</span>
                      <TaskPriorityBadge priority={task.priority} />
                    </div>
                    <CalendarTaskLink
                      task={task}
                      className="line-clamp-2 font-medium text-ink hover:text-accent hover:underline"
                    >
                      {task.title}
                    </CalendarTaskLink>
                    <div className="flex items-center justify-between text-muted pt-1">
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          userId={task.assignee.id}
                          projectId={task.projectId}
                          name={task.assignee.name}
                        />
                        <span className="truncate max-w-28">{task.assignee.name}</span>
                      </div>
                      <TaskStatusBadge status={task.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Modal: Day Tasks Detail List */}
      {selectedDayTasks && (
        <Modal
          open={!!selectedDayTasks}
          onClose={() => setSelectedDayTasks(null)}
          title={`Nhiệm vụ ngày ${formatDisplayDate(selectedDayTasks.date)}`}
          description={`${selectedDayTasks.tasks.length} nhiệm vụ có hạn chót trong ngày này.`}
          maxWidth="lg"
        >
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {selectedDayTasks.tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-3 text-xs transition hover:border-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-accent">{task.code}</span>
                    <TaskStatusBadge status={task.status} />
                    <TaskPriorityBadge priority={task.priority} />
                  </div>
                  {renderActions && (
                    <div className="shrink-0">{renderActions(task)}</div>
                  )}
                </div>

                <a
                  href={`/tasks/${task.id}`}
                  className="text-sm font-semibold text-ink hover:text-accent"
                >
                  {task.title}
                </a>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-muted">
                  <div className="flex items-center gap-2">
                    <Avatar
                      userId={task.assignee.id}
                      projectId={task.projectId}
                      name={task.assignee.name}
                    />
                    <AccountName userId={task.assignee.id} name={task.assignee.name} />
                  </div>

                  <div className="flex items-center gap-3">
                    {task.estimatedHours > 0 && (
                      <span>Ước tính: {task.estimatedHours}h</span>
                    )}
                    {task.spentHours !== undefined && (
                      <span>Đã làm: {task.spentHours.toFixed(1)}h</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setSelectedDayTasks(null)}>
              Đóng
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
