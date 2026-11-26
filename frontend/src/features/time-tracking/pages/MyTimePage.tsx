import { canDevelopProject } from '../../projects/model/project.validation';
import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Pagination } from '../../../shared/ui/Pagination';
import { useWorkspace, type TimeEntry } from '../../workspace';
import { useProjects } from '../../projects';
import { ActiveTimerCard } from '../components/ActiveTimerCard';
import { AddManualTimeModal } from '../components/modals/AddManualTimeModal';
import { EditTimeModal } from '../components/modals/EditTimeModal';
import { useTimeRevisions } from '../hooks/useTimeRevisions';
import {
  filterTimeEntries,
  intervalSeconds,
  summarizeTime,
  type TimeFilters,
} from '../model/timesheet';
import { formatDuration, type ActiveTimer } from '../model/timer';

export interface MyTimePageProps {
  now: number;
  timer: ActiveTimer | null;
  onStopTimer: () => void;
}
function timestamp(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}
export function MyTimePage({ now, timer, onStopTimer }: MyTimePageProps) {
  const workspace = useWorkspace();
  const projects = useProjects();
  const entries = workspace.data?.timeEntries ?? [];
  const tasks = workspace.data?.tasks ?? [];
  const [filters, setFilters] = useState<TimeFilters>({
    search: '',
    projectId: 'ALL',
    taskId: 'ALL',
    fromDate: '',
    toDate: '',
  });
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TimeEntry>();
  const revisions = useTimeRevisions(workspace.userId, workspace.loadedAt);
  const projectNames = new Map(
    projects.map((project) => [project.id, project.name]),
  );
  const activeProjects = new Set(
    projects
      .filter(canDevelopProject)
      .map((project) => project.id),
  );
  const eligibleTasks = tasks.filter(
    (task) =>
      task.assignee.id === workspace.userId &&
      activeProjects.has(task.projectId) &&
      !['DONE', 'CANCELLED'].includes(task.status),
  );
  const canEdit = (entry: TimeEntry) =>
    !!entry.endedAt &&
    activeProjects.has(String(entry.projectId)) &&
    tasks.some(
      (task) =>
        task.id === String(entry.taskId) &&
        !['DONE', 'CANCELLED'].includes(task.status),
    );
  const filtered = filterTimeEntries(entries, filters, now);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 20) - 1),
  );
  const stats = summarizeTime(entries, now);
  const changeFilter = (patch: Partial<TimeFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  };
  const dateError =
    !!filters.fromDate && !!filters.toDate && filters.fromDate > filters.toDate;
  const control =
    'min-w-0 rounded-xl border border-line bg-field px-3 py-2 text-sm text-ink';
  return (
    <main className="my-time-page space-y-6">
      <PageHeader eyebrow="KHÔNG GIAN CÁ NHÂN" title="Giờ làm của tôi" description="Thời gian đã ghi trên hệ thống, theo múi giờ Việt Nam." actions={<Button onClick={() => setAdding(true)} disabled={!eligibleTasks.length}>+ Bổ sung giờ</Button>} />
      {timer ? (
        <ActiveTimerCard timer={timer} onStop={onStopTimer} />
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
          Bạn chưa có phiên đang chạy.{' '}
          <a href="/my-tasks" className="font-semibold text-accent">
            Mở công việc để bắt đầu ghi giờ
          </a>
          .
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {['Hôm nay', 'Tuần này', 'Tháng này'].map((label, index) => (
          <section
            key={label}
            className="rounded-2xl border border-line bg-surface p-5"
          >
            <h2 className="text-sm text-muted">{label}</h2>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
              {formatDuration(stats[index])}
            </p>
          </section>
        ))}
      </div>
      <p className="text-xs text-muted">
        Thống kê gồm phiên đã kết thúc và thời gian đang chạy; phiên qua đêm
        được chia theo ngày. Thời lượng không phải điểm năng suất.
      </p>
      <section
        aria-label="Lọc phiên ghi giờ"
        className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <input
          aria-label="Tìm dự án hoặc nhiệm vụ"
          placeholder="Tìm tên hoặc mã nhiệm vụ"
          className={control}
          value={filters.search}
          onChange={(event) => changeFilter({ search: event.target.value })}
        />
        <select
          aria-label="Lọc dự án"
          className={control}
          value={filters.projectId}
          onChange={(event) =>
            changeFilter({ projectId: event.target.value, taskId: 'ALL' })
          }
        >
          <option value="ALL">Tất cả dự án</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc nhiệm vụ"
          className={control}
          value={filters.taskId}
          onChange={(event) => changeFilter({ taskId: event.target.value })}
        >
          <option value="ALL">Tất cả nhiệm vụ</option>
          {[
            ...new Map(
              entries
                .filter(
                  (entry) =>
                    filters.projectId === 'ALL' ||
                    String(entry.projectId) === filters.projectId,
                )
                .map((entry) => [entry.taskId, entry]),
            ).values(),
          ].map((entry) => (
            <option key={entry.taskId} value={entry.taskId}>
              TSK-{entry.taskId} · {entry.taskTitle}
            </option>
          ))}
        </select>
        <label className="grid gap-2 text-xs text-muted">
          Từ ngày
          <input
            type="date"
            className={control}
            value={filters.fromDate}
            onChange={(event) => changeFilter({ fromDate: event.target.value })}
          />
        </label>
        <label className="grid gap-2 text-xs text-muted">
          Đến ngày
          <input
            type="date"
            className={control}
            value={filters.toDate}
            onChange={(event) => changeFilter({ toDate: event.target.value })}
          />
        </label>
        <Button
          variant="secondary"
          onClick={() =>
            changeFilter({
              search: '',
              projectId: 'ALL',
              taskId: 'ALL',
              fromDate: '',
              toDate: '',
            })
          }
        >
          Xóa bộ lọc
        </Button>
      </section>
      {dateError ? (
        <p role="alert" className="text-sm text-danger">
          Ngày kết thúc không được trước ngày bắt đầu.
        </p>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-panel text-muted">
                  <th className="p-4">Dự án / nhiệm vụ</th>
                  <th className="p-4">Bắt đầu</th>
                  <th className="p-4">Kết thúc</th>
                  <th className="p-4">Thời lượng</th>
                  <th className="p-4">Nguồn / trạng thái</th>
                  <th className="p-4">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .slice(currentPage * 20, currentPage * 20 + 20)
                  .map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-line last:border-0"
                    >
                      <td className="max-w-72 p-4">
                        <a
                          href={`/tasks/${entry.taskId}`}
                          className="break-words font-semibold text-accent"
                        >
                          {entry.taskTitle}
                        </a>
                        <p className="mt-1 text-xs text-muted">
                          {entry.projectName}
                        </p>
                      </td>
                      <td className="p-4 text-xs">
                        {timestamp(entry.startedAt)}
                      </td>
                      <td className="p-4 text-xs">
                        {entry.endedAt
                          ? timestamp(entry.endedAt)
                          : 'Đang ghi giờ'}
                      </td>
                      <td className="p-4 font-mono tabular-nums">
                        {formatDuration(intervalSeconds(entry, now))}
                      </td>
                      <td className="p-4 text-xs text-muted">
                        {entry.source === 'MANUAL'
                          ? 'Bổ sung thủ công'
                          : 'Timer'}
                        <p
                          className={
                            entry.endedAt
                              ? 'mt-1 text-success'
                              : 'mt-1 text-accent'
                          }
                        >
                          {entry.endedAt ? 'Đã lưu' : 'Đang chạy'}
                        </p>
                      </td>
                      <td className="p-4">
                        {canEdit(entry) ? (
                          <button
                            type="button"
                            onClick={() => setEditing(entry)}
                            className="font-semibold text-accent"
                          >
                            Sửa
                          </button>
                        ) : (
                          <span className="text-xs text-muted">Chỉ xem</span>
                        )}
                      </td>
                    </tr>
                  ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted">
                      {entries.length
                        ? 'Không có phiên phù hợp bộ lọc.'
                        : 'Bạn chưa ghi nhận giờ làm.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            total={filtered.length}
            onChange={setPage}
          />
        </section>
      )}
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Lịch sử điều chỉnh gần đây</h2>
        <p className="text-xs text-muted">
          Tối đa 50 lần sửa gần nhất của chính bạn. Lý do bổ sung được lưu cùng
          phiên thủ công.
        </p>
        {revisions.loading && (
          <p role="status" className="text-sm text-muted">
            Đang tải lịch sử...
          </p>
        )}
        {revisions.error && (
          <p role="alert" className="text-sm text-danger">
            {revisions.error}{' '}
            <button
              type="button"
              onClick={() => {
                void workspace.refresh();
              }}
              className="underline"
            >
              Thử lại
            </button>
          </p>
        )}
        {!revisions.loading && !revisions.error && !revisions.rows.length && (
          <p className="text-sm text-muted">Chưa có lần điều chỉnh nào.</p>
        )}
        {revisions.rows.map((revision) => (
          <article
            key={revision.id}
            className="space-y-2 rounded-xl border border-line bg-panel p-4 text-sm"
          >
            <h3 className="font-semibold">
              Bạn đã sửa phiên · {revision.taskTitle}
            </h3>
            <p className="text-xs text-muted">
              {revision.projectName} · {timestamp(revision.revisedAt)}
            </p>
            <p className="break-words whitespace-pre-wrap">
              Lý do: {revision.reason}
            </p>
            <p className="text-xs text-muted">
              Trước: {timestamp(revision.beforeStartedAt)} →{' '}
              {timestamp(revision.beforeEndedAt)}
            </p>
            <p className="text-xs text-muted">
              Sau: {timestamp(revision.afterStartedAt)} →{' '}
              {timestamp(revision.afterEndedAt)}
            </p>
          </article>
        ))}
      </section>
      {adding && (
        <AddManualTimeModal
          tasks={eligibleTasks}
          projectNames={projectNames}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <EditTimeModal
          key={`${editing.id}/${editing.version}`}
          entry={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </main>
  );
}
