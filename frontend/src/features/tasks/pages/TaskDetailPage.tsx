import { canDevelopProject, developmentReadOnlyReason } from '../../projects/model/project.validation';
import { useTaskOrganization } from '../model/task-organization.api';
import { TaskSubmissionHistory } from '../components/TaskSubmissionHistory';
import { TaskUpdateHistory } from '../components/TaskUpdateHistory';
import { TaskChecklistPanel } from '../components/TaskChecklistPanel';
import {
  TASK_TAG_PRESETS,
  toggleTaskPin,
  usePinnedTasks,
} from '../model/task-organization';
import { InlineAiHint, useTaskAiBrief } from '../../ai';
import { AccountName } from '../../profile/components/AccountName';
import { TaskDeadlineAlert } from '../components/TaskDeadlineAlert';
import { TaskTimeSummary } from '../../time-tracking/components/TaskTimeSummary';
import { Panel } from '../../../shared/ui/Panel';
import { UserAvatar as Avatar } from '../../profile/components/UserAvatar';
import { TaskTransitionModal } from '../components/modals/TaskTransitionModal';
import { availableTransitions, statusLabels } from '../model/task-board';
import type { TaskStatus } from '../model/task.types';
import { TaskComments } from '../../collaboration';
import { TaskManagement } from '../components/TaskManagement';
import { startTask } from '../api/task.api';
import { startTimer, useServerTimer, formatDuration } from '../../time-tracking';
import { Button } from '../../../shared/ui/Button';
import { useId, useRef, useState } from 'react';
import { useProjects } from '../../projects';
import { useWorkspace } from '../../workspace';
import type { Task } from '../model/task.types';
import {
  TaskStatusBadge,
  TaskPriorityBadge,
} from '../components/TaskStatusBadge';
import { Tabs } from '../../../shared/ui/Tabs';
import { TaskTimeBudget } from '../components/TaskTimeBudget';
export function TaskDetailPage({ task }: { task: Task }) {
  const workspace = useWorkspace();
  const { timer, now, stopTimer, error: timerError } = useServerTimer();
  const [stopping, setStopping] = useState(false);
  const runningHere = timer?.taskId === task.id;

  const project = useProjects().find(
    (project) => project.id === task.projectId,
  );
  const isAssignee = task.assignee.id === workspace.userId && project?.role !== 'Customer';
  const active = canDevelopProject(project);
  const developmentReason = developmentReadOnlyReason(project);
  const archived = project?.status === 'ARCHIVED';
  const ai = useTaskAiBrief(task, project?.role ?? 'Member', project?.status === 'ACTIVE' && !workspace.error);
  const insights = ai.brief?.insights;
  const organization=useTaskOrganization(workspace.userId,task.projectId,task.id);
  const tags = organization.data?.tags??[];
  const pinnedIds = usePinnedTasks(workspace.userId);
  const isPinned = pinnedIds.includes(String(task.id));
  const tabId = useId();
  const historyTabId = useId();
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [historyTab, setHistoryTab] = useState<'submissions' | 'updates'>('submissions');
  const [target,setTarget]=useState<TaskStatus>();
  const [historyRevision, setHistoryRevision] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  function showHistory(section: 'submissions' | 'updates') {
    setHistoryTab(section);
    setTab('history');
    setHistoryRevision(value => value + 1);
  }
  const action = async (kind: 'start' | 'timer') => {
    if (!workspace.userId || busy.current) return;
    if (!active) {
      setError(
        'Dự án đã lưu trữ chỉ được xem lại; không thể bắt đầu thực hiện hoặc ghi giờ.',
      );
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(undefined);
    try {
      if (kind === 'timer' && task.isBlocked) throw new Error('Hãy gỡ cờ bị chặn trước khi ghi giờ.');
      if (kind === 'start')
        await startTask(
          workspace.userId,
          task.projectId,
          task.id,
          task.version,
        );
      else await startTimer(workspace.userId, task.projectId, task.id);
      await workspace.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Không thể lưu thao tác.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const transitions=availableTransitions(task,workspace.userId,project?.role??'Member',!active);
  return <main className="mx-auto max-w-[1500px] space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 py-2"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-tint text-sm font-bold text-accent">{project?.name.slice(0,2).toUpperCase()}</span><div><p className="text-[11px] font-bold uppercase tracking-widest text-accent">Dự án</p><a href={`/projects/${task.projectId}`} className="text-xl font-semibold">{project?.name??'Chi tiết nhiệm vụ'}</a></div></div><a href={`/projects/${task.projectId}?tab=members`} className="rounded-xl border border-line px-4 py-2 text-sm text-muted">Thành viên dự án</a></header>
    <nav className="flex gap-6 overflow-x-auto border-b border-line text-sm text-muted" aria-label="Điều hướng dự án">
      {([{key:'overview',label:'Tổng quan'},{key:'tasks',label:'Nhiệm vụ'},{key:'members',label:'Thành viên'},{key:'resources',label:'Tài liệu & Liên kết'},{key:'settings',label:'Cài đặt'}] as const).map(item=><a key={item.key} href={`/projects/${task.projectId}?tab=${item.key}`} aria-current={item.key==='tasks'?'page':undefined} className={`whitespace-nowrap border-b-2 pb-3 ${item.key==='tasks'?'border-accent font-semibold text-accent':'border-transparent hover:text-ink'}`}>{item.label}</a>)}
    </nav>
    <a href={`/projects/${task.projectId}?tab=tasks`} className="inline-block text-xs text-muted">← Quay lại danh sách nhiệm vụ</a>
    {!archived && developmentReason && <p role="status" className="rounded-xl border border-line bg-panel p-3.5 text-sm text-muted">{developmentReason}</p>}
    {archived && <p role="status" className="rounded-xl border border-line bg-panel p-3.5 text-sm text-muted">Dự án đã được lưu trữ. Nhiệm vụ đang ở chế độ chỉ xem; không thể bắt đầu thực hiện hoặc ghi giờ.</p>}
    <div className="detail-layout">
      <div className="detail-main min-w-0">
        <Panel className="task-heading"><div className="task-kicker mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="text-xs text-muted">{task.code}</span><TaskStatusBadge status={task.status}/></div><button type="button" onClick={() => toggleTaskPin(task.id, workspace.userId)} aria-pressed={isPinned} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${isPinned ? 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300' : 'border-line bg-panel text-muted hover:text-ink'}`}>{isPinned ? '★ Đã ghim ưu tiên' : '☆ Ghim nhiệm vụ'}</button></div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{task.title}</h1><div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Nhãn phân loại nhiệm vụ"><span className="mr-1 text-xs text-muted">Nhãn:</span>{TASK_TAG_PRESETS.map(preset => { const activeTag = tags.includes(preset.id); return <button key={preset.id} type="button" disabled={!active||!organization.data?.canEdit||organization.busy||!!organization.error} aria-pressed={activeTag} onClick={() => void organization.save(data=>({checklist:data.checklist,tags:data.tags.includes(preset.id)?data.tags.filter(tag=>tag!==preset.id):[...data.tags,preset.id]}))} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${activeTag ? 'border-accent bg-tint text-accent shadow-xs' : 'border-line bg-panel/60 text-muted opacity-75 hover:opacity-100'}`}>{activeTag ? `✓ ${preset.label}` : `+ ${preset.label}`}</button>; })}</div>{organization.error&&<p role="alert" className="mt-2 text-sm text-danger">{organization.error}<button className="ml-2 underline" onClick={()=>void organization.reload()}>Tải lại nhãn</button></p>}<p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted">{task.description||'Chưa có mô tả.'}</p>

        <TaskDeadlineAlert task={task} now={now} expanded />

        {task.isBlocked&&<p className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">Đang bị chặn · {task.blockedReason}</p>}

        {!['DONE','CANCELLED'].includes(task.status) && <TaskTimeBudget estimated={task.estimatedHours} logged={task.spentHours} />}

        <TaskChecklistPanel
          projectId={task.projectId}
          taskId={task.id}
          taskTitle={task.title}
          description={task.description}
          aiHint={insights?.nextStep}
          readOnly={!active || ['DONE', 'CANCELLED'].includes(task.status)}
        />

        </Panel>
        <Panel className="discussion">
          <Tabs idPrefix={tabId} label="Nội dung nhiệm vụ" value={tab} onChange={setTab} items={[
            { value: 'comments', label: 'Bình luận' },
            { value: 'history', label: 'Lịch sử' },
          ]} />
          <div id={`${tabId}-panel-comments`} role="tabpanel" aria-labelledby={`${tabId}-tab-comments`} className="pt-5" hidden={tab !== 'comments'}>
            <TaskComments project={task.projectId} task={task.id} />
          </div>
          <div id={`${tabId}-panel-history`} role="tabpanel" aria-labelledby={`${tabId}-tab-history`} className="pt-3" hidden={tab !== 'history'}>
            <Tabs idPrefix={historyTabId} label="Loại lịch sử nhiệm vụ" value={historyTab} onChange={setHistoryTab} items={[
              { value: 'submissions', label: 'Các lần nộp' },
              { value: 'updates', label: 'Cập nhật nhiệm vụ' },
            ]} />
            <div id={`${historyTabId}-panel-submissions`} role="tabpanel" aria-labelledby={`${historyTabId}-tab-submissions`} className="pt-4" hidden={historyTab !== 'submissions'}>
              <TaskSubmissionHistory userId={workspace.userId} project={task.projectId} task={task.id}
                active={tab === 'history' && historyTab === 'submissions'} taskVersion={task.version} revision={historyRevision} />
            </div>
            <div id={`${historyTabId}-panel-updates`} role="tabpanel" aria-labelledby={`${historyTabId}-tab-updates`} className="pt-4" hidden={historyTab !== 'updates'}>
              {tab === 'history' && historyTab === 'updates' && workspace.userId && (
                <TaskUpdateHistory key={`${workspace.userId}/${task.projectId}/${task.id}/${task.version}/${historyRevision}`}
                  userId={workspace.userId} projectId={task.projectId} taskId={task.id} />
              )}
            </div>
          </div>
        </Panel>
      </div>
      <aside className="detail-side">
        <Panel className="action-panel"><h2 className="text-xs font-bold uppercase tracking-wider text-accent">Thao tác của bạn</h2><p className="rounded-lg bg-field p-3 text-xs leading-5 text-muted">{!active?(developmentReason ?? (project?.role === 'Customer' ? 'Bạn đang theo dõi dự án với tư cách khách hàng.' : 'Dự án đang lưu trữ, chỉ cho phép xem.')):task.assignee.isCurrentUser?'Bạn là người phụ trách nhiệm vụ này.':project?.role==='Customer'?'Bạn đang theo dõi dự án với tư cách khách hàng.':project?.role==='Member'?'Bạn đang xem nhiệm vụ của thành viên khác.':'Bạn có quyền quản lý nhiệm vụ.'}</p>{error&&<p role="alert" className="text-sm text-danger">{error}</p>}
        {active && isAssignee && task.status === 'IN_PROGRESS' && !task.isBlocked && <InlineAiHint text={insights?.nextStep} existing={[task.decision?.nextStep ?? '', ...(task.decision?.reasons ?? [])]} />}
        {timerError && <p role="alert" className="text-xs text-danger">{timerError}</p>}
        {runningHere ? <Button icon="pause" loading={stopping} className="w-full" onClick={async () => { setStopping(true); try { await stopTimer(); } finally { setStopping(false); } }}>Dừng ghi giờ · {formatDuration(timer.elapsedSeconds)}</Button>
          : active && isAssignee && task.status === 'IN_PROGRESS' ? <>
            <Button icon="play" loading={saving} disabled={!!timer || task.isBlocked} className="w-full" onClick={() => void action('timer')}>Bắt đầu ghi giờ</Button>
            {task.isBlocked && <p className="text-xs text-danger">Nhiệm vụ đang bị chặn. Gỡ cờ để tiếp tục ghi giờ.</p>}{timer && <p className="text-xs leading-5 text-muted">Bạn đang ghi giờ cho <a className="font-semibold text-accent" href={`/tasks/${timer.taskId}`}>{timer.taskTitle}</a>. Hãy dừng phiên đó trước khi bắt đầu phiên mới.</p>}
          </> : <p className="text-xs leading-5 text-muted">{!active ? 'Dự án chỉ xem nên không thể bắt đầu ghi giờ.' : !isAssignee ? 'Chỉ người được giao nhiệm vụ mới có thể ghi giờ. Quyền quản lý không cho phép ghi giờ thay thành viên.' : task.status === 'TODO' ? 'Chọn Bắt đầu thực hiện để chuyển nhiệm vụ sang Đang thực hiện, sau đó có thể ghi giờ.' : 'Chỉ có thể bắt đầu ghi giờ khi nhiệm vụ đang thực hiện.'}</p>}
        {transitions.map(status=><button key={status} onClick={()=>setTarget(status)} className="w-full rounded-xl border border-line px-4 py-3 text-sm font-medium hover:bg-field">{status==='IN_PROGRESS'&&task.status==='TODO'?'Bắt đầu thực hiện':status==='REVIEW'?'Gửi chờ duyệt':status==='DONE'?'Duyệt hoàn thành':status==='IN_PROGRESS'&&task.status!=='TODO'?'Yêu cầu thực hiện lại':status==='CANCELLED'?'Hủy nhiệm vụ':statusLabels[status]}</button>)}
        <TaskManagement task={task} onSaved={() => showHistory('updates')} />
        {task.status==='IN_PROGRESS'&&task.assignee.isCurrentUser&&<p className="text-[11px] leading-5 text-muted">Gửi chờ duyệt cần ghi chú kết quả và sẽ kết thúc phiên ghi giờ đang chạy.</p>}
        </Panel>
        <Panel className="properties"><h2 className="mb-4 font-medium">Thông tin nhiệm vụ</h2><dl className="divide-y divide-line text-xs">{[['Người phụ trách',task.assignee.name],['Ngày bắt đầu',task.startDate??'Chưa có'],['Deadline',task.deadline??'Chưa có'],['Ước tính',`${task.estimatedHours} giờ`],['Đã ghi',task.spentHours===undefined?'Không có quyền xem':`${task.spentHours.toFixed(2)} giờ`]].map(([label,value])=><div key={label} className="grid grid-cols-2 gap-3 py-4"><dt className="text-muted">{label}</dt><dd className="flex items-center gap-2 break-words font-medium">{label==='Người phụ trách'&&<Avatar userId={task.assignee.id} projectId={task.projectId} name={value} className="size-6"/>}{label==='Người phụ trách'?<AccountName userId={task.assignee.id} name={task.assignee.name}/>:value}</dd></div>)}<div className="flex items-center justify-between py-4"><dt className="text-muted">Ưu tiên</dt><dd><TaskPriorityBadge priority={task.priority}/></dd></div></dl></Panel>
        {isAssignee && <TaskTimeSummary entries={workspace.data?.timeEntries ?? []} taskId={task.id} projectId={task.projectId} now={now} loading={!workspace.data} />}
      </aside>
    </div>{target && <TaskTransitionModal task={task} target={target}
      onSaved={() => showHistory(target === 'REVIEW' || task.status === 'REVIEW' ? 'submissions' : 'updates')}
      onClose={() => setTarget(undefined)} />}
  </main>;
}
