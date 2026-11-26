import { Icon, type IconName } from '../../../shared/ui/Icon';
import type { TaskStat, TaskStatKey } from '../model/dashboard.types';

const statConfig: Record<TaskStatKey, { label: string; href: string; tone: string; icon: IconName }> = {
  in_progress: { label: 'Đang thực hiện', href: '/my-tasks?scope=active&status=in_progress', tone: 'text-accent', icon: 'play' },
  due_soon: { label: 'Sắp đến hạn', href: '/my-tasks?scope=active&filter=due_soon', tone: 'text-warning', icon: 'calendar' },
  overdue: { label: 'Quá hạn thực hiện', href: '/my-tasks?scope=active&filter=overdue', tone: 'text-danger', icon: 'alert' },
  needs_review: { label: 'Cần duyệt', href: '/tasks-needing-review', tone: 'text-warning', icon: 'inbox' },
  awaiting_review: { label: 'Chờ duyệt', href: '/my-tasks?scope=active&status=awaiting_review', tone: 'text-review', icon: 'clock' },
};

export function TaskStatCards({ stats }: { stats: TaskStat[] }) {
  return (
    <ul aria-label="Chỉ số công việc" className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-5">
      {stats.map(({ key, count }) => {
        const { label, href, tone, icon } = statConfig[key];
        const urgent = count > 0 && (key === 'overdue' || key === 'needs_review');
        return (
          <li key={key} className={key === 'needs_review' ? 'col-span-2 min-w-0 lg:col-span-1' : 'min-w-0'}>
            <a href={href} className={`group relative isolate flex h-full min-h-36 flex-col overflow-hidden rounded-2xl border bg-surface p-3.5 shadow-panel sm:p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-[translate,border-color,box-shadow] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 hover:border-current hover:shadow-md ${tone} ${urgent ? 'border-current/30' : 'border-line'}`}>
              <span aria-hidden="true" className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br to-transparent to-80% ${urgent ? 'from-current/12' : 'from-current/6'}`} />
              <span className="flex items-center justify-between gap-2">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl border border-current/10 bg-current/8">
                  <Icon name={icon} size={17} />
                </span>
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted group-hover:text-accent motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5">
                  <Icon name="arrow" size={15} />
                </span>
              </span>
              <strong className={`mt-4 break-words text-3xl font-bold leading-none tracking-tight tabular-nums ${urgent ? '' : 'text-ink'}`}>
                {count.toLocaleString('vi-VN')}
              </strong>
              <span className="mt-2 text-xs font-semibold leading-snug text-muted sm:text-sm">{label}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
