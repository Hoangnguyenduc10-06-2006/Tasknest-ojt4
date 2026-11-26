import { useEffect, useMemo, useState } from 'react';
import { authenticatedAccessToken } from '../../../auth';
import { requestJson } from '../../../../shared/api/client';
import { Badge } from '../../../../shared/ui/Badge';
import { Icon } from '../../../../shared/ui/Icon';
import { Pagination } from '../../../../shared/ui/Pagination';
import type { Task } from '../../../tasks';
import { historyFields } from '../../../tasks/model/task-history';
import { useWorkspace } from '../../../workspace';

type ProjectActivityRow = {
  id: number;
  project_id?: number;
  task_id?: number | null;
  task_title?: string | null;
  actor_user_id: string | null;
  action: string;
  entity_type?: string;
  entity_id?: string;
  before_data?: string | null;
  after_data?: string | null;
  reason?: string | null;
  created_at: string;
};

type ActivityResponse = {
  data: {
    items: ProjectActivityRow[];
    total: number;
    page: number;
    size: number;
  };
};

const ACTION_LABELS: Record<string, { label: string; tone: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'neutral' }> = {
  PROJECT_CREATED: { label: 'Khởi tạo dự án', tone: 'purple' },
  PROJECT_UPDATED: { label: 'Cập nhật thông tin dự án', tone: 'blue' },
  PROJECT_ARCHIVED: { label: 'Lưu trữ dự án', tone: 'amber' },
  PROJECT_REOPENED: { label: 'Mở lại dự án', tone: 'green' },
  PROJECT_REOPEN_REQUEST: { label: 'Yêu cầu mở lại dự án', tone: 'neutral' },
  PROJECT_REOPEN_APPROVE: { label: 'Hai bên đồng ý mở lại dự án', tone: 'green' },
  PROJECT_REOPEN_DECLINE: { label: 'Từ chối mở lại dự án', tone: 'neutral' },
  PROJECT_REOPEN_CANCEL: { label: 'Rút yêu cầu mở lại dự án', tone: 'neutral' },
  TASK_CREATED: { label: 'Tạo nhiệm vụ mới', tone: 'blue' },
  TASK_UPDATED: { label: 'Cập nhật nhiệm vụ', tone: 'blue' },
  TASK_STARTED: { label: 'Bắt đầu thực hiện', tone: 'blue' },
  TASK_SUBMITTED: { label: 'Gửi kết quả chờ duyệt', tone: 'purple' },
  TASK_APPROVED: { label: 'Duyệt hoàn thành nhiệm vụ', tone: 'green' },
  TASK_REJECTED: { label: 'Yêu cầu làm lại nhiệm vụ', tone: 'amber' },
  TASK_REOPENED: { label: 'Mở lại nhiệm vụ', tone: 'amber' },
  TASK_CANCELLED: { label: 'Hủy nhiệm vụ', tone: 'red' },
  TASK_BLOCK_CHANGED: { label: 'Cập nhật cờ bị chặn', tone: 'red' },
  TASK_ALERT: { label: 'Phát cảnh báo tự động', tone: 'amber' },
  TIMER_STARTED: { label: 'Bắt đầu bấm giờ', tone: 'blue' },
  TIMER_STOPPED: { label: 'Kết thúc phiên ghi giờ', tone: 'neutral' },
  TIME_ENTRY_CREATED: { label: 'Bổ sung giờ làm thủ công', tone: 'blue' },
  TIME_ENTRY_UPDATED: { label: 'Điều chỉnh phiên giờ làm', tone: 'amber' },
  COMMENT_CREATED: { label: 'Thêm bình luận mới', tone: 'neutral' },
  COMMENT_EDITED: { label: 'Chỉnh sửa bình luận', tone: 'neutral' },
  COMMENT_DELETED: { label: 'Xóa bình luận', tone: 'red' },
  INVITATION_CREATED: { label: 'Gửi lời mời trực tiếp', tone: 'purple' },
  INVITATION_ACCEPTED: { label: 'Chấp nhận lời mời tham gia', tone: 'green' },
  INVITATION_REJECTED: { label: 'Từ chối lời mời tham gia', tone: 'amber' },
  JOIN_REQUEST_CREATED: { label: 'Gửi yêu cầu tham gia qua Link/QR', tone: 'purple' },
  JOIN_REQUEST_ACCEPTED: { label: 'Duyệt yêu cầu tham gia', tone: 'green' },
  JOIN_REQUEST_REJECTED: { label: 'Từ chối yêu cầu tham gia', tone: 'red' },
  MEMBER_ROLE_CHANGED: { label: 'Thay đổi vai trò thành viên', tone: 'purple' },
  MEMBER_REMOVED: { label: 'Xóa thành viên khỏi dự án', tone: 'red' },
};

function synthesizeFallbackActivities(projectId: string, tasks: Task[]): ProjectActivityRow[] {
  return tasks.map((task, idx) => ({
    id: idx + 1,
    project_id: Number(projectId) || 1,
    task_id: Number(task.id) || idx + 1,
    task_title: task.title,
    actor_user_id: task.assignee.id,
    action:
      task.status === 'DONE'
        ? 'TASK_APPROVED'
        : task.status === 'REVIEW'
          ? 'TASK_SUBMITTED'
          : task.status === 'IN_PROGRESS'
            ? 'TASK_STARTED'
            : 'TASK_CREATED',
    entity_type: 'TASK',
    entity_id: task.id,
    before_data: null,
    after_data: JSON.stringify({
      title: task.title,
      assigneeId: task.assignee.id,
      status: task.status,
      priority: task.priority,
      deadline_on: task.deadline,
    }),
    created_at: task.createdAt || new Date().toISOString(),
  }));
}

export function ProjectActivityFeed({ projectId, tasks }: { projectId: string; tasks: Task[] }) {
  const workspace = useWorkspace();
  const members = useMemo(
    () => (workspace.data?.members ?? []).filter((m) => String(m.projectId) === String(projectId)),
    [workspace.data?.members, projectId]
  );
  const [category, setCategory] = useState<'ALL' | 'TASK' | 'MEMBER' | 'ALERT'>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const fallbackRows = useMemo(() => synthesizeFallbackActivities(projectId, tasks), [projectId, tasks]);
  const [fetched, setFetched] = useState<{ key: string; items: ProjectActivityRow[]; total: number } | null>(null);
  const requestKey = `${workspace.userId ?? ''}:${projectId}:${category}:${page}`;
  const loading = Boolean(workspace.userId) && fetched?.key !== requestKey;

  useEffect(() => {
    let active = true;
    const userId = workspace.userId;
    if (!userId) return;
    void authenticatedAccessToken(userId)
      .then((accessToken) =>
        requestJson<ActivityResponse>(
          `/api/work/projects/${projectId}/activities?category=${category}&page=${page}&size=20`,
          { accessToken }
        )
      )
      .then((response) => {
        if (!active) return;
        setFetched({ key: requestKey, items: response.data.items, total: response.data.total });
      })
      .catch(() => {
        if (!active) return;
        setFetched({ key: requestKey, items: fallbackRows, total: fallbackRows.length });
      });
    return () => {
      active = false;
    };
  }, [workspace.userId, projectId, category, page, requestKey, fallbackRows]);

  const rows = workspace.userId ? (fetched?.key === requestKey ? fetched.items : null) : fallbackRows;
  const total = workspace.userId ? (fetched?.key === requestKey ? fetched.total : 0) : fallbackRows.length;

  const visibleRows = useMemo(() => {
    const source = rows ?? [];
    const q = search.trim().toLocaleLowerCase('vi');
    if (!q) return source;
    return source.filter((item) => {
      const actionLabel = ACTION_LABELS[item.action]?.label ?? item.action;
      const actorName = members.find((m) => m.id === item.actor_user_id)?.name ?? item.actor_user_id ?? 'Hệ thống';
      return `${actionLabel} ${actorName} ${item.task_title ?? ''}`.toLocaleLowerCase('vi').includes(q);
    });
  }, [rows, search, members]);

  return (
    <section className="space-y-5" aria-label="Nhật ký hoạt động dự án">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc nhóm hoạt động">
          {(
            [
              { key: 'ALL', label: 'Tất cả hoạt động' },
              { key: 'TASK', label: 'Nhiệm vụ & Giờ làm' },
              { key: 'MEMBER', label: 'Thành viên & Lời mời' },
              { key: 'ALERT', label: 'Cảnh báo tự động' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={category === item.key}
              onClick={() => {
                setCategory(item.key);
                setPage(0);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                category === item.key
                  ? 'bg-accent text-on-accent shadow-sm'
                  : 'border border-line bg-panel text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-field px-3 py-1.5 text-xs">
          <Icon name="search" size={15} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo thành viên, nhiệm vụ..."
            aria-label="Tìm hoạt động trong dự án"
            className="w-48 bg-transparent text-ink outline-none"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        {loading && !rows && (
          <p role="status" className="py-8 text-center text-sm text-muted">
            Đang tải nhật ký hoạt động dự án…
          </p>
        )}
        {visibleRows.length === 0 && !loading ? (
          <p className="py-10 text-center text-sm text-muted">
            Chưa có hoạt động nào khớp với bộ lọc hiện tại.
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {visibleRows.map((item) => {
              const config = ACTION_LABELS[item.action] ?? { label: item.action, tone: 'neutral' as const };
              const actorName =
                members.find((m) => m.id === item.actor_user_id)?.name ??
                (item.actor_user_id ? 'Thành viên dự án' : 'Hệ thống tự động');
              return (
                <li key={item.id} className="space-y-2 py-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={config.tone}>{config.label}</Badge>
                      <strong className="text-ink">{actorName}</strong>
                      {item.task_id && (
                        <a
                          href={`/tasks/${item.task_id}`}
                          className="rounded-lg bg-tint px-2 py-0.5 text-xs font-semibold text-accent hover:underline"
                        >
                          {item.task_title ? `#${item.task_id} · ${item.task_title}` : `Nhiệm vụ #${item.task_id}`}
                        </a>
                      )}
                    </div>
                    <time className="text-xs text-muted" dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                    </time>
                  </div>
                  {(item.before_data || item.after_data) && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium text-accent">Chi tiết dữ liệu thay đổi</summary>
                      <div className="mt-2 grid gap-3 rounded-xl border border-line bg-panel/40 p-3 sm:grid-cols-2">
                        {[
                          { label: 'Trước thay đổi', raw: item.before_data ?? null },
                          { label: 'Sau thay đổi', raw: item.after_data ?? null },
                        ].map((side) => {
                          const parsed = historyFields(side.raw, members);
                          return (
                            <div key={side.label}>
                              <h4 className="font-semibold text-ink">{side.label}</h4>
                              {parsed.length > 0 ? (
                                <dl className="mt-1.5 space-y-1">
                                  {parsed.map((field) => (
                                    <div key={field.label} className="flex gap-2">
                                      <dt className="text-muted">{field.label}:</dt>
                                      <dd className="font-medium text-ink">{field.value}</dd>
                                    </div>
                                  ))}
                                </dl>
                              ) : (
                                <p className="mt-1 text-muted">Không có dữ liệu</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {total > 20 && <Pagination page={page} total={total} size={20} onChange={setPage} />}
      </div>
    </section>
  );
}
