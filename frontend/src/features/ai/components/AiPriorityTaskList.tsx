import type { MyProjectItem } from '../../projects';
import type { Task } from '../../tasks';
import { TaskPriorityBadge, TaskStatusBadge } from '../../tasks/components/TaskStatusBadge';
import { selectMyPriorityTasks } from '../model/my-priority-tasks';

export function AiPriorityTaskList({ tasks, projects, userId }: {
  tasks: readonly Task[];
  projects: readonly MyProjectItem[];
  userId: string;
}) {
  const ranked = selectMyPriorityTasks(tasks, projects, userId);
  const projectNames = new Map(projects.map(project => [project.id, project.name]));

  return (
    <section aria-label="Công việc cần làm">
      <h3 className="font-semibold">Công việc cần làm <span className="text-muted">({ranked.length})</span></h3>
      <p className="mt-1 text-sm text-muted">Ưu tiên từ cao đến thấp. Cùng mức ưu tiên, xét điểm cảnh báo rồi đến hạn chót.</p>
      {ranked.length === 0 ? (
        <p className="mt-4 rounded-xl bg-panel p-4 text-sm text-muted">Bạn chưa có công việc cần làm trong dự án đang hoạt động.</p>
      ) : (
        <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
          {ranked.map((task, index) => (
            <li key={task.id} className="flex items-start gap-3 p-3">
              <span aria-hidden="true" className="text-sm tabular-nums text-muted">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <a href={`/tasks/${task.id}`} className="break-words text-sm font-semibold text-accent hover:underline">{task.title}</a>
                <p className="mt-1 text-xs text-muted">{task.code} · {projectNames.get(task.projectId)} · {task.deadline ?? 'Chưa đặt hạn'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <TaskPriorityBadge priority={task.priority} />
                  <TaskStatusBadge status={task.isBlocked ? 'BLOCKED' : task.status} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
