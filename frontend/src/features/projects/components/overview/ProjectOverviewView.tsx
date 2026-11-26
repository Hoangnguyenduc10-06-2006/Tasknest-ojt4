import { ProjectAnalytics } from './ProjectAnalytics';
import { ProjectHealthPanel } from './ProjectHealthPanel';
import { summarizeTasks, type Task, type TaskStatus } from '../../../tasks';

export interface ProjectOverviewViewProps {
  projectId: string;
  tasks: Task[];
  onNavigateToTasks: (status?: TaskStatus) => void;
}
const statuses: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'TODO', label: 'Chưa bắt đầu', color: 'bg-muted' },
  { key: 'IN_PROGRESS', label: 'Đang thực hiện', color: 'bg-accent' },
  { key: 'REVIEW', label: 'Chờ duyệt', color: 'bg-review' },
  { key: 'DONE', label: 'Hoàn thành', color: 'bg-success' },
  { key: 'CANCELLED', label: 'Đã hủy', color: 'bg-muted' },
];

export function ProjectOverviewView({
  tasks,
  projectId,
  onNavigateToTasks,
}: ProjectOverviewViewProps) {
  const { completed, progress, estimated, logged } = summarizeTasks(tasks);
  const eligible = tasks.filter((task) => task.status !== 'CANCELLED').length;
  const openTasks = tasks.filter(
    (task) => !['DONE', 'CANCELLED'].includes(task.status),
  );
  const members = [
    ...new Map(openTasks.map((task) => [task.assignee.id, task.assignee])).values(),
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Tổng nhiệm vụ', value: tasks.length, status: undefined },
          {
            label: 'Đang thực hiện',
            value: tasks.filter((task) => task.status === 'IN_PROGRESS').length,
            status: 'IN_PROGRESS' as const,
          },
          {
            label: 'Chờ duyệt',
            value: tasks.filter((task) => task.status === 'REVIEW').length,
            status: 'REVIEW' as const,
          },
          { label: 'Hoàn thành', value: completed, status: 'DONE' as const },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => onNavigateToTasks(stat.status)}
            className="rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="text-sm text-muted">{stat.label}</span>
            <strong className="mt-3 block text-3xl font-bold tracking-tight">
              {stat.value}
            </strong>
            <span className="mt-3 block text-xs text-accent">
              Xem nhiệm vụ →
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="font-semibold">Tiến độ dự án</h2>
          <p className="mt-1 text-sm text-muted">
            Tỷ lệ nhiệm vụ đã hoàn thành.
          </p>
          <div className="mt-6 flex flex-col items-center gap-7 sm:flex-row">
            <div
              role="img"
              aria-label={`Hoàn thành ${eligible ? `${progress}%` : 'Chưa có nhiệm vụ'}`}
              className="relative flex size-40 shrink-0 items-center justify-center rounded-full"
              style={{
                background: eligible ? `conic-gradient(var(--success) ${progress}%, var(--panel) 0)` : 'var(--panel)',
              }}
            >
              <div className="flex size-32 flex-col items-center justify-center rounded-full bg-surface">
                <strong className="text-3xl">
                  {eligible ? `${progress}%` : 'Chưa có nhiệm vụ'}
                </strong>
                <span className="mt-1 text-xs text-muted">
                  {completed}/{eligible} nhiệm vụ
                </span>
              </div>
            </div>
            <div className="w-full space-y-3">
              {statuses.map((status) => (
                <button
                  key={status.key}
                  onClick={() => onNavigateToTasks(status.key)}
                  className="flex w-full items-center gap-2 rounded-lg p-1 text-sm hover:bg-panel"
                >
                  <span className={`size-2 rounded-full ${status.color}`} />
                  <span className="text-muted">{status.label}</span>
                  <strong className="ml-auto">
                    {tasks.filter((task) => task.status === status.key).length}
                  </strong>
                </button>
              ))}
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="font-semibold">Phân bổ công việc</h2>
          <p className="mt-1 text-sm text-muted">
            Số nhiệm vụ chưa hoàn thành/chưa hủy theo người phụ trách.
          </p>
          <div className="mt-6 space-y-5">
            {members.length ? (
              members.map((member) => {
                const count = openTasks.filter(
                  (task) => task.assignee.id === member.id,
                ).length;
                return (
                  <div key={member.id}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{member.name}</span>
                      <span className="shrink-0 text-muted">
                        {count} nhiệm vụ
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-panel">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${(count / Math.max(1, openTasks.length)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-10 text-center text-sm text-muted">
                Chưa có nhiệm vụ được phân công.
              </p>
            )}
          </div>
        </section>
      </div>
      <ProjectHealthPanel tasks={tasks} />
      <section className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div>
          <h2 className="font-semibold">Thời gian thực hiện</h2>
          <p className="mt-1 text-sm text-muted">
            Tổng hợp từ các nhiệm vụ trong dự án.
          </p>
        </div>
        <div className="flex gap-10">
          <div>
            <span className="text-xs text-muted">Ước tính</span>
            <p className="mt-1 text-2xl font-semibold">
              {estimated} <span className="text-sm text-muted">giờ</span>
            </p>
          </div>
          <div>
            <span className="text-xs text-muted">Giờ làm được phép xem</span>
            <p className="mt-1 text-2xl font-semibold">
              {logged.toFixed(2)}{' '}
              <span className="text-sm text-muted">giờ</span>
            </p>
          </div>
        </div>
      </section>
      <ProjectAnalytics project={projectId} />
    </div>
  );
}
