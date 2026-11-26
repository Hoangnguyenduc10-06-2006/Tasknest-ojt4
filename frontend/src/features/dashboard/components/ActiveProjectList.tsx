import type { ActiveProject } from '../model/dashboard.types';
import { RoleBadge } from '../../../shared/ui/RoleBadge';
import { getCompletionPercentage } from '../model/progress';
import { DashboardPanel } from './DashboardPanel';

const toneClasses: Record<ActiveProject['tone'], string> = {
  accent: 'bg-tint text-accent',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  review: 'bg-review-soft text-review',
};


export function ActiveProjectList({ projects }: { projects: ActiveProject[] }) {
  return (
    <DashboardPanel title="Dự án đang tham gia" description={`${projects.length} dự án đang hoạt động`} viewAllHref="/my-projects">
      {projects.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Bạn chưa tham gia dự án nào.</p>
      ) : (
        <ul className="divide-y divide-line px-5 pb-2">
          {projects.map((project) => {
            const percent = getCompletionPercentage(project.completedTasks, project.eligibleTasks);
            return (
              <li key={project.id}>
                <a
                  href={`/projects/${project.id}`}
                  className="-mx-2 my-1 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-field focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${toneClasses[project.tone]}`}>{project.initials}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{project.name}</span>
                      <span className="text-sm font-bold tabular-nums">{percent === null ? 'Chưa có nhiệm vụ' : `${percent}%`}</span>
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-3 text-[11px] text-muted">
                      <span>{project.memberCount} thành viên · <RoleBadge role={project.role} prefix="Bạn là " /></span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-3">
                      {percent !== null && <span
                        role="progressbar"
                        aria-label={`Tiến độ ${project.name}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                        className="h-2.5 flex-1 overflow-hidden rounded-full bg-field"
                      >
                        <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${percent}%` }} />
                      </span>}
                      <span className="shrink-0 text-[11px] text-muted tabular-nums">{project.completedTasks} / {project.eligibleTasks} việc</span>
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}
