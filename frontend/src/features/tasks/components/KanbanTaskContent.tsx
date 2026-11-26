import { useTaskOrganization } from '../model/task-organization.api';
import { useWorkspace } from '../../workspace';
import { AccountName } from '../../profile/components/AccountName';
import { TaskDeadlineAlert } from './TaskDeadlineAlert';
import type { ReactNode } from 'react';
import { Icon } from '../../../shared/ui/Icon';
import { UserAvatar as Avatar } from '../../profile/components/UserAvatar';
import { Badge } from '../../../shared/ui/Badge';
import { TaskPriorityBadge } from './TaskStatusBadge';
import type { Task } from '../model/task.types';
import { summarizeChecklist } from '../model/task-checklist';
import { getTagMeta, toggleTaskPin, usePinnedTasks } from '../model/task-organization';

export function KanbanTaskContent({ task, actions }: { task: Task; actions?: ReactNode }) {
  const open = !['DONE', 'CANCELLED'].includes(task.status);
  const ratio = task.estimatedHours > 0 && task.spentHours !== undefined ? task.spentHours / task.estimatedHours : 0;
  const warning = task.riskBadge || (open && ratio >= .8 ? (ratio > 1 ? 'Vượt ước tính' : 'Rủi ro vượt ước tính') : '');
  const deadline = task.deadline && /^\d{4}-\d{2}-\d{2}$/.test(task.deadline)
    ? new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${task.deadline}T00:00:00+07:00`))
    : task.deadline || 'Chưa đặt hạn';
  const workspace=useWorkspace();
  const shared=useTaskOrganization(workspace.userId,task.projectId,task.id);
  const tags = shared.data?.tags??[];
  const checklist=summarizeChecklist(shared.data?.checklist??[]);
  const pinned = usePinnedTasks(workspace.userId).includes(String(task.id));
  return <>
    <div className="task-card-top">
      <span className="inline-flex items-center gap-1.5">
        {task.code}
        <button
          type="button"
          aria-label={pinned ? `Bỏ ghim ${task.code}` : `Ghim ${task.code}`}
          title={pinned ? 'Bỏ ghim ưu tiên' : 'Ghim nhiệm vụ'}
          onClick={(event) => {
            event.stopPropagation();
            toggleTaskPin(task.id);
          }}
          className={`text-xs transition ${pinned ? 'text-amber-500' : 'text-muted/50 hover:text-amber-500'}`}
        >
          {pinned ? '★' : '☆'}
        </button>
      </span>
      {actions && <details className="relative" onClick={event => event.stopPropagation()}>
        <summary aria-label={`Thao tác ${task.code}`} className="list-none cursor-pointer rounded p-1 text-muted focus-visible:outline-2 focus-visible:outline-accent"><Icon name="more" size={16} /></summary>
        <div className="absolute right-0 top-full z-10 min-w-44 rounded-lg border border-line bg-surface p-2 shadow-lg">{actions}</div>
      </details>}
    </div>
    <strong><a draggable={false} href={`/tasks/${task.id}`} className="block break-words hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">{task.title}</a></strong>
    {tags.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {tags.map((tagId) => {
          const meta = getTagMeta(tagId);
          return <Badge key={tagId} tone={meta.tone}>{meta.label}</Badge>;
        })}
      </div>
    )}
    {checklist.total > 0 && (
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-panel px-2 py-0.5 text-[11px] font-medium text-muted">
        <Icon name="check" size={12} />
        <span>{checklist.completed}/{checklist.total} bước ({checklist.percent}%)</span>
      </div>
    )}
    {task.isBlocked && <Badge tone="red" title={task.blockedReason}><Icon name="alert" size={12} />Đang bị chặn</Badge>}
    {warning && <Badge tone={task.riskType === 'danger' ? 'red' : 'amber'} className="max-w-full whitespace-normal"><Icon name="alert" size={12} />{warning}</Badge>}
    <TaskDeadlineAlert task={task} />
    <div className="task-card-meta"><TaskPriorityBadge priority={task.priority} /><span><Icon name="calendar" size={14} />{deadline}</span></div>
    <div className="task-card-foot">
      <Avatar userId={task.assignee.id} projectId={task.projectId} name={task.assignee.name} />
      <AccountName userId={task.assignee.id} name={task.assignee.name} />
      {task.commentsCount !== undefined && <span className="comment-count"><Icon name="message" size={14} />{task.commentsCount}</span>}
    </div>
  </>;
}
