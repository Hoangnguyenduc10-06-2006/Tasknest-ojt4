import { useWorkspace } from '../../workspace';
import { useTaskOrganization } from '../model/task-organization.api';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import {
  suggestChecklistSteps,
  summarizeChecklist,

} from '../model/task-checklist';

export function TaskChecklistPanel({
  taskId,
  projectId,
  taskTitle,
  description,
  aiHint,
  readOnly: suppliedReadOnly = false,
}: {
  taskId: string;
  projectId: string;
  taskTitle: string;
  description?: string;
  aiHint?: string;
  readOnly?: boolean;
}) {
  const workspace=useWorkspace();
  const shared=useTaskOrganization(workspace.userId,projectId,taskId);
  const items=shared.data?.checklist??[];
  const readOnly=suppliedReadOnly||!shared.data?.canEdit||shared.busy||!!shared.error;
  async function update(checklist: typeof items) {return shared.save(data=>({tags:data.tags,checklist}));}
  async function suggest() {const additions=suggestChecklistSteps(taskTitle,description,aiHint).filter(title=>!items.some(item=>item.title===title)).map(title=>({id:crypto.randomUUID(),title,completed:false,createdAt:new Date().toISOString()}));await update([...items,...additions]);}
  const [draft, setDraft] = useState('');
  const { total, completed, percent } = summarizeChecklist(items);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (readOnly || !draft.trim()) return;
    if(await update([...items,{id:crypto.randomUUID(),title:draft.trim(),completed:false,createdAt:new Date().toISOString()}]))setDraft('');
  }

  return (
    <div className="mt-5 rounded-2xl border border-line bg-panel/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-tint text-accent">
            <Icon name="check" size={15} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Checklist các bước thực hiện</h2>
            <p className="text-xs text-muted">
              {total > 0
                ? `Đã hoàn thành ${completed}/${total} bước (${percent}%)`
                : 'Chia nhỏ nhiệm vụ thành các bước để chủ động theo dõi tiến độ.'}
            </p>
          </div>
        </div>
        {!readOnly && (
          <Button
            type="button"
            kind="secondary"
            size="sm"
            onClick={() => void suggest()}
          >
            ✦ Gợi ý bước từ mô tả / AI
          </Button>
        )}
      </div>

      {shared.busy&&<p role="status" className="mt-3 text-xs text-muted">Đang lưu checklist và nhãn…</p>}
      {!shared.data&&!shared.error&&<p role="status" className="mt-3 text-xs text-muted">Đang tải checklist…</p>}
      {shared.error&&<div role="alert" className="mt-3 text-sm text-danger">{shared.error}<Button kind="ghost" size="sm" onClick={()=>void shared.reload()}>Tải lại</Button></div>}
      {total > 0 && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line/60" aria-label={`Tiến độ checklist ${percent}%`}>
          <div
            className="h-full rounded-full bg-success transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line/60 rounded-xl border border-line bg-surface px-3" aria-label="Danh sách bước thực hiện">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={readOnly}
                  onChange={() => void update(items.map(step=>step.id===item.id?{...step,completed:!step.completed}:step))}
                  className="size-4 shrink-0 rounded border-line accent-accent"
                />
                <span className={`break-words ${item.completed ? 'text-muted line-through' : 'text-ink'}`}>
                  {item.title}
                </span>
              </label>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Xóa bước ${item.title}`}
                  title="Xóa bước này"
                  onClick={() => void update(items.filter(step=>step.id!==item.id))}
                  className="rounded-lg p-1 text-muted transition hover:bg-danger/10 hover:text-danger"
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <form onSubmit={event=>void handleAdd(event)} className="mt-3 flex gap-2">
          <input
            type="text"
            value={draft}
            maxLength={200}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Thêm bước con mới (ví dụ: Viết unit test cho API)..."
            aria-label="Thêm bước checklist"
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={!draft.trim()}>
            Thêm bước
          </Button>
        </form>
      )}
    </div>
  );
}
