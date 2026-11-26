import { getCompletionPercentage } from '../model/progress';
import type { ActiveProject } from '../model/dashboard.types';

export function ProjectProgressSummary({ projects }: { projects: ActiveProject[] }) {
  const completed = projects.reduce((sum, project) => sum + project.completedTasks, 0);
  const total = projects.reduce((sum, project) => sum + project.eligibleTasks, 0);
  const percent = getCompletionPercentage(completed, total);
  const remaining = total - completed;

  return (
    <figure className="rounded-2xl border border-line bg-surface p-5 shadow-panel">
      <figcaption>
        <h2 className="text-base font-semibold">Tiến độ các dự án đang hoạt động</h2>
        <p className="mt-1 text-sm text-muted">
          {percent === null ? 'Chưa có nhiệm vụ để tính tiến độ.' : `${completed}/${total} nhiệm vụ đã hoàn thành · ${projects.length} dự án`}
        </p>
      </figcaption>
      {percent !== null && (
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="relative grid size-28 shrink-0 place-items-center" aria-hidden="true">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" fill="none" strokeWidth="9">
              <circle cx="50" cy="50" r="44" stroke="currentColor" className="text-tint" />
              <circle cx="50" cy="50" r="44" pathLength="100" stroke="currentColor" strokeDasharray={`${(completed / total) * 100} 100`} className="text-accent" />
            </svg>
            <strong className="text-2xl font-bold tabular-nums">{percent}%</strong>
          </div>
          <dl className="min-w-[9rem] flex-1 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="inline-flex items-center gap-2 text-muted"><span className="size-2.5 rounded-full bg-accent" />Đã hoàn thành</dt>
              <dd className="font-semibold tabular-nums">{completed}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="inline-flex items-center gap-2 text-muted"><span className="size-2.5 rounded-full border border-line bg-tint" />Còn lại</dt>
              <dd className="font-semibold tabular-nums">{remaining}</dd>
            </div>
          </dl>
        </div>
      )}
    </figure>
  );
}
