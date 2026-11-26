import { useCallback, useState } from 'react';
import { authenticatedAccessToken } from '../../auth';
import { useWorkspace } from '../../workspace';
import { requestJson } from '../../../shared/api/client';
import { useReloadableData } from '../../../shared/hooks/useReloadableData';
import { Button } from '../../../shared/ui/Button';
import { Pagination } from '../../../shared/ui/Pagination';
import { submissionTimestamp } from '../model/submission-history';
import { taskHistoryChanges } from '../model/task-history';

type Update = {
  id: number;
  actor_user_id: string | null;
  action: string;
  before_data: string | null;
  after_data: string | null;
  created_at: string;
};

const labels: Record<string, string> = {
  TASK_UPDATED: 'Cập nhật nhiệm vụ',
  TASK_BLOCK_CHANGED: 'Thay đổi trạng thái bị chặn',
  TASK_CREATED: 'Tạo nhiệm vụ',
  TASK_STARTED: 'Bắt đầu thực hiện',
  TASK_SUBMITTED: 'Nộp kết quả',
  TASK_APPROVED: 'Duyệt hoàn thành',
  TASK_REJECTED: 'Yêu cầu làm lại',
  TASK_REOPENED: 'Mở lại nhiệm vụ',
  TASK_CANCELLED: 'Hủy nhiệm vụ',
  TIMER_STARTED: 'Bắt đầu ghi giờ',
  TIMER_STOPPED: 'Dừng ghi giờ',
  COMMENT_CREATED: 'Gửi bình luận',
  COMMENT_EDITED: 'Sửa bình luận',
  COMMENT_DELETED: 'Xóa bình luận',
  TASK_ALERT: 'Phát cảnh báo nhiệm vụ',
  TIME_ADDED: 'Thêm giờ làm',
  TIME_EDITED: 'Điều chỉnh giờ làm',
  TIME_ENTRY_CREATED: 'Thêm giờ làm',
  TIME_ENTRY_UPDATED: 'Điều chỉnh giờ làm',
};
const pageSize = 20;

export function TaskUpdateHistory({ userId, projectId, taskId }: {
  userId: string; projectId: string; taskId: string;
}) {
  const workspace = useWorkspace();
  const members = workspace.data?.members.filter(member => member.projectId === projectId) ?? [];
  const load = useCallback(async () => {
    const accessToken = await authenticatedAccessToken(userId);
    return requestJson<{ data: Update[] }>(`/api/work/projects/${projectId}/tasks/${taskId}/history`, { accessToken });
  }, [userId, projectId, taskId]);
  const { data, error, refresh } = useReloadableData(load);
  const [page, setPage] = useState(0);
  const total = data?.length ?? 0;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(total / pageSize) - 1));
  const updates = data?.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return <section className="space-y-4" aria-label="Cập nhật nhiệm vụ">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-muted">Các thay đổi mới nhất, theo giờ Việt Nam.</p>
      <Button variant="secondary" size="sm" onClick={refresh}>Tải lại cập nhật</Button>
    </div>
    {error ? <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>
      : !updates ? <p role="status" className="text-sm text-muted">Đang tải cập nhật…</p>
      : !updates.length ? <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Chưa có cập nhật nào.</p>
      : <>
        <ol className="space-y-3">
          {updates.map(update => {
            const changes = taskHistoryChanges(update.before_data, update.after_data, members);
            const actor = members.find(member => member.id === update.actor_user_id)?.name
              ?? (update.actor_user_id ? 'Thành viên cũ' : 'Hệ thống');
            return <li key={update.id} className="rounded-xl border border-line bg-surface p-4">
              <h3 className="text-sm font-semibold">{labels[update.action] ?? 'Hoạt động nhiệm vụ'}</h3>
              <p className="mt-1 text-xs text-muted">
                {actor} · <time dateTime={update.created_at}>{submissionTimestamp(update.created_at)}</time>
              </p>
              {changes.length > 0 && <details className="mt-3 rounded-lg bg-panel p-3">
                <summary className="cursor-pointer text-xs font-semibold text-accent">Chi tiết cập nhật</summary>
                <dl className="mt-3 divide-y divide-line">
                  {changes.map(change => <div key={change.label} className="py-2 first:pt-0 last:pb-0">
                    <dt className="text-xs font-semibold text-muted">{change.label}</dt>
                    <dd className="mt-1.5 grid gap-2 text-sm [overflow-wrap:anywhere] sm:grid-cols-2">
                      {change.changed && <div className="whitespace-pre-wrap"><span className="mr-2 text-xs text-muted">Trước</span>{change.before}</div>}
                      <div className="whitespace-pre-wrap">{change.changed && <span className="mr-2 text-xs text-muted">Sau</span>}{change.after}</div>
                    </dd>
                  </div>)}
                </dl>
              </details>}
            </li>;
          })}
        </ol>
        {total >= 200 && <p className="text-xs text-muted">Đang hiển thị 200 cập nhật gần nhất.</p>}
        {total > pageSize && <Pagination page={currentPage} size={pageSize} total={total} onChange={setPage} />}
      </>}
  </section>;
}
