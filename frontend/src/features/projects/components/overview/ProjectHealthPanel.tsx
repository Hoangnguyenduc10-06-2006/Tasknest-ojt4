import type { Task } from '../../../tasks';
import { projectHealth } from '../../model/project-health';

export function ProjectHealthPanel({ tasks }: { tasks: Task[] }) {
  const current = projectHealth(tasks);
  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-semibold">Sức khỏe dự án</h2>
        <span className="text-sm text-muted">{current.open} nhiệm vụ đang mở</span>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Quá hạn', count: current.overdue, color: 'text-danger' },
          { label: 'Bị chặn', count: current.blocked, color: 'text-warning' },
          { label: 'Rủi ro cao', count: current.risky, color: 'text-warning' },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-panel p-3 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className={`font-semibold ${count ? color : 'text-ink'}`}>{count}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6">
        <h3 className="font-medium">Nhiệm vụ cần xử lý</h3>
        {current.attention.length > 0 ? (
          <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {current.attention.map(({ task, reasons }) => (
              <li key={task.id}>
                <a href={`/tasks/${task.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 text-sm hover:bg-panel focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                  <div className="min-w-0">
                    <p className="wrap-break-word font-semibold"><span className="text-accent">{task.code}</span> · {task.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {task.assignee.name}{task.deadline && ` · Hạn ${task.deadline.split('-').reverse().join('/')}`}
                    </p>
                    {task.isBlocked && task.blockedReason && <p className="mt-1 line-clamp-2 wrap-break-word text-xs text-muted">{task.blockedReason}</p>}
                  </div>
                  <span className="rounded-lg bg-warning/10 px-2 py-1 text-xs font-medium text-warning">{reasons.join(' · ')}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted">Chưa có nhiệm vụ cần xử lý.</p>}
      </div>
    </section>
  );
}
