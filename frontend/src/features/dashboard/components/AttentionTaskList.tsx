import { InlineAiHint } from '../../ai';
import type { AttentionReason, AttentionTask, TaskPriority } from '../model/dashboard.types';
import { DashboardPanel } from './DashboardPanel';

const reasonConfig: Record<AttentionReason, { label: string; className: string }> = {
  estimate_risk: { label: 'Rủi ro vượt ước tính', className: 'bg-warning-soft text-warning' },
  over_estimate: { label: 'Vượt ước tính', className: 'bg-danger-soft text-danger' },
  blocked: { label: 'Đang bị chặn', className: 'bg-danger-soft text-danger' },
  overdue: { label: 'Quá hạn', className: 'bg-danger-soft text-danger' },
};

const priorityBar: Record<TaskPriority, { label: string; className: string }> = {
  high: { label: 'Ưu tiên cao', className: 'bg-danger' },
  medium: { label: 'Ưu tiên trung bình', className: 'bg-warning' },
  low: { label: 'Ưu tiên thấp', className: 'bg-success' },
};

const avatarTones = ['bg-tint text-accent', 'bg-success-soft text-success', 'bg-review-soft text-review', 'bg-warning-soft text-warning'];

function avatarTone(initials: string) {
  const sum = [...initials].reduce((total, char) => total + char.charCodeAt(0), 0);
  return avatarTones[sum % avatarTones.length];
}

export function AttentionTaskList({ tasks, taskHints }: { tasks: AttentionTask[]; taskHints?: Record<string, string> }) {
  return (
    <DashboardPanel title="Công việc cần chú ý" description="Tự sắp xếp theo deadline, vướng mắc và mức ưu tiên" viewAllHref="/my-tasks">
      {tasks.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Không có công việc nào cần chú ý. Tuyệt vời!</p>
      ) : (
        <ul className="divide-y divide-line px-5 pb-2">
          {tasks.map((task) => {
            const priority = priorityBar[task.priority];
            return (
              <li key={task.id}>
                <a
                  href={`/tasks/${task.id}`}
                  className="my-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl px-2 py-3 hover:bg-field focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span role="img" aria-label={priority.label} className={`h-9 w-1 shrink-0 rounded-full ${priority.className}`} />
                  <span className="min-w-0">
                    <strong className="block break-words text-sm">{task.title}</strong>
                    <small className="mt-1 block break-words text-muted">{task.projectName} · {task.dueLabel}</small>
                    {task.decision && <small className="mt-1 block whitespace-normal text-ink">{task.decision.reasons.join(' · ')}<span className="mt-1 block text-muted">{task.decision.nextStep}</span></small>}
                    <InlineAiHint text={taskHints?.[task.id]} existing={[...(task.decision?.reasons ?? []), task.decision?.nextStep ?? '']} />
                  </span>
                    <span className="col-start-2 row-start-2 flex flex-wrap gap-1">
                      {task.reasons.map((key) => (
                        <span key={key} className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${reasonConfig[key].className}`}>{reasonConfig[key].label}</span>
                      ))}
                    </span>
                  <span
                    title={task.assignee.name}
                    aria-label={`Người thực hiện: ${task.assignee.name}`}
                    className={`col-start-3 row-start-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${avatarTone(task.assignee.initials)}`}
                  >
                    {task.assignee.initials}
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
