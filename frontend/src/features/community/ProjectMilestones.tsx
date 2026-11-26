import { DraftButton } from './DraftButton';
import { composerDraftStorageKey } from './draftStorage';
import { useComposerField, useComposerStatus } from './composer.state';
import { ComposerDialog, ComposerEntry } from './ComposerDialog';
import { useState, type FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { TextAreaField } from '../../shared/ui/TextAreaField';
import type { MyProjectItem } from '../projects/model/project.types';
import type { Task } from '../tasks';
import {
  communityRequest,
  communityQueryId,
  dateLabel,
  errorMessage,
  inputClass,
  panelClass,
  useCommunityResource,
} from './community.api';
import { Pagination } from './CommunityPagination';
import {
  milestoneLabels,
  submissionLabels,
  type Milestone,
  type MilestoneDetails,
  type MilestonePage,
  type MilestoneSubmission,
} from './milestones.api';

export function ProjectMilestones({
  project,
  tasks,
}: {
  project: MyProjectItem;
  tasks: Task[];
}) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<number | null>(() =>
    communityQueryId('milestone')
      ? Number(communityQueryId('milestone'))
      : null,
  );
  const resource = useCommunityResource<MilestonePage>(
    `projects/${project.id}/milestones?page=${page}`,
  );
  const data = resource.data;
  if (resource.error)
    return <MilestoneError message={resource.error} reload={resource.reload} />;
  if (!data) return <p role="status">Đang tải mốc bàn giao…</p>;
  if (!data.configured)
    return (
      <section className={panelClass}>
        <h2 className="text-xl font-semibold">Mốc bàn giao</h2>
        <p className="mt-3 text-sm text-muted">
          Thiết lập đội thực hiện và khách hàng trong tab Nghiệm thu & Đánh giá
          để bắt đầu thống nhất các mốc.
        </p>
      </section>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Mốc bàn giao</h2>
          <p className="mt-2 text-sm text-muted">
            Theo dõi kế hoạch, kết quả và phản hồi của khách hàng theo từng mốc.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button kind="ghost" size="sm" onClick={() => void resource.reload()}>
            Tải dữ liệu mới
          </Button>
          {data.canManage && resource.user && (
            <ComposerEntry
              user={resource.user}
              scope={`project:${project.id}:milestone:new`}
              title="Tạo mốc bàn giao"
              submitLabel="Gửi kế hoạch mốc"
            >
              <MilestonePlanForm
                user={resource.user}
                project={project.id}
                tasks={tasks}
                onSaved={async (id) => {
                  setSelected(id);
                  await resource.reload();
                }}
              />
            </ComposerEntry>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [data.counts.total, 'Tổng số mốc'],
          [data.counts.accepted, 'Đã chấp nhận'],
          [data.counts.awaiting_review, 'Chờ nghiệm thu'],
          [data.counts.changes_requested, 'Cần chỉnh sửa'],
        ].map(([value, label]) => (
          <div key={String(label)} className={panelClass}>
            <p className="text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.items.map((milestone) => (
          <button
            key={milestone.id}
            type="button"
            className={
              panelClass +
              ' min-w-0 space-y-3 text-left hover:border-accent ' +
              (selected === milestone.id ? 'border-accent' : '')
            }
            onClick={() => setSelected(milestone.id)}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="min-w-0 break-words text-lg font-semibold">
                {milestone.title}
              </h3>
              <span className="text-xs text-accent">
                {milestoneLabels[milestone.status]}
              </span>
            </div>
            <p className="text-sm text-muted">
              Bàn giao dự kiến · {dateLabel(milestone.due_on)}
            </p>
            <p className="text-xs text-muted">
              {milestone.criteria.length} tiêu chí ·{' '}
              {milestone.task_count
                ? milestone.closed_tasks +
                  '/' +
                  milestone.task_count +
                  ' nhiệm vụ đã xử lý'
                : 'Chưa liên kết nhiệm vụ'}{' '}
              · {milestone.submission_count} lần bàn giao
            </p>
          </button>
        ))}
      </div>
      {!data.items.length && (
        <p className={panelClass + ' text-sm text-muted'}>
          Chưa có mốc bàn giao. Đội thực hiện tạo kế hoạch để khách hàng xem và
          xác nhận.
        </p>
      )}
      <Pagination
        page={page}
        total={data.counts.total}
        size={20}
        onChange={setPage}
      />
      {selected != null && resource.user && (
        <MilestoneDetail
          key={selected}
          project={project.id}
          id={selected}
          user={resource.user}
          tasks={tasks}
          access={data}
          onChanged={resource.reload}
        />
      )}
    </div>
  );
}
function MilestoneError({
  message,
  reload,
}: {
  message: string;
  reload: () => unknown;
}) {
  return (
    <div className={panelClass} role="alert">
      <p className="mb-3 text-danger">{message}</p>
      <Button onClick={() => void reload()}>Thử lại</Button>
    </div>
  );
}
function MilestonePlanForm({
  user,
  project,
  tasks,
  milestone,
  onSaved,
}: {
  user: string;
  project: string;
  tasks: Task[];
  milestone?: MilestoneDetails;
  onSaved: (id: number) => Promise<void>;
}) {
  const [title, setTitle] = useComposerField('title', milestone?.title ?? '');
  const [due, setDue] = useComposerField('due', milestone?.due_on ?? '');
  const [criteria, setCriteria] = useComposerField(
    'criteria',
    milestone?.criteria.join('\n') ?? '',
  );
  const [selected, setSelected] = useComposerField<string[]>(
    'selected',
    milestone?.tasks.map((task) => String(task.id)) ?? [],
  );
  const [search, setSearch] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    due?: string;
    criteria?: string;
  }>({});
  const composer = useComposerStatus(busy, error);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const errors: typeof fieldErrors = {};
    if (!title.trim()) {
      errors.title = 'Vui lòng điền vào trường này.';
    }
    if (!due) {
      errors.due = 'Vui lòng điền vào trường này.';
    }
    const items = criteria
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!items.length) {
      errors.criteria = 'Vui lòng điền vào trường này.';
    } else if (
      items.length > 20 ||
      items.some((value) => value.length > 300)
    ) {
      errors.criteria = 'Nhập từ 1–20 tiêu chí, mỗi tiêu chí tối đa 300 ký tự.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setBusy(true);
    try {
      const id = await communityRequest<number>(
        `projects/${project}/milestones${milestone ? '/' + milestone.id : ''}`,
        user,
        {
          title,
          criteria: items,
          dueOn: due,
          taskIds: selected.map(Number),
          requestId,
          version: milestone?.version,
        },
        milestone ? 'PUT' : 'POST',
      );
      composer?.complete();
      await onSaved(id);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      id={composer?.formId}
      noValidate
      className={(composer ? '' : panelClass) + ' space-y-4'}
      onSubmit={(event) => void submit(event)}
    >
      <fieldset disabled={busy} className="space-y-4">
        <legend className="sr-only">Kế hoạch mốc bàn giao</legend>
        <h3 className="text-lg font-semibold">
          {milestone ? 'Chỉnh sửa kế hoạch' : 'Thống nhất mốc với khách hàng'}
        </h3>
        <TextField
          label="Tên mốc bàn giao"
          required
          maxLength={150}
          value={title}
          error={fieldErrors.title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (fieldErrors.title)
              setFieldErrors((prev) => ({ ...prev, title: undefined }));
          }}
        />
        <TextField
          label="Ngày bàn giao dự kiến"
          type="date"
          required
          value={due}
          error={fieldErrors.due}
          onChange={(event) => {
            setDue(event.target.value);
            if (fieldErrors.due)
              setFieldErrors((prev) => ({ ...prev, due: undefined }));
          }}
        />
        <TextAreaField
          label="Tiêu chí nghiệm thu"
          rows={5}
          required
          maxLength={6020}
          value={criteria}
          error={fieldErrors.criteria}
          onChange={(event) => {
            setCriteria(event.target.value);
            if (fieldErrors.criteria)
              setFieldErrors((prev) => ({ ...prev, criteria: undefined }));
          }}
          placeholder="Mỗi dòng một tiêu chí cụ thể để khách hàng kiểm tra."
        />
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Nhiệm vụ liên kết · {selected.length}/100
          </p>
          <TextField
            label="Tìm nhiệm vụ để liên kết"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tên hoặc mã nhiệm vụ"
          />
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-line p-3">
            {tasks
              .filter((task) =>
                (task.title + ' ' + task.code)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((task) => (
                <label key={task.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.includes(task.id)}
                    disabled={
                      !selected.includes(task.id) && selected.length >= 100
                    }
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, task.id]
                          : current.filter((id) => id !== task.id),
                      )
                    }
                  />
                  <span>
                    {task.code} · {task.title}
                  </span>
                </label>
              ))}
            {!tasks.length && (
              <p className="text-xs text-muted">
                Chưa có nhiệm vụ trong dự án. Bạn có thể bổ sung ở tab Nhiệm vụ.
              </p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted">
          Khách hàng xác nhận kế hoạch trước khi đội gửi kết quả. Tiêu chí và
          danh sách nhiệm vụ được giữ theo kế hoạch đã xác nhận.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {!composer && (
          <Button type="submit" loading={busy}>
            {milestone ? 'Lưu kế hoạch' : 'Gửi kế hoạch mốc'}
          </Button>
        )}
      </fieldset>
    </form>
  );
}
function MilestoneDetail({
  project,
  id,
  user,
  tasks,
  access,
  onChanged,
}: {
  project: string;
  id: number;
  user: string;
  tasks: Task[];
  access: MilestonePage;
  onChanged: () => Promise<void>;
}) {
  const [page, setPage] = useState(0);
  const resource = useCommunityResource<MilestoneDetails>(
    `projects/${project}/milestones/${id}?page=${page}`,
  );
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function changed() {
    await resource.reload();
    await onChanged();
  }
  async function action(
    path: string,
    body: unknown,
    success: string,
    post = false,
    propagate = false,
  ) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await communityRequest(
        `projects/${project}/milestones/${id}/${path}`,
        user,
        body,
        post ? 'POST' : 'PUT',
      );
      await changed();
      setMessage(success);
      setCancelling(false);
    } catch (error) {
      setMessage(errorMessage(error));
      if (propagate) throw error;
    } finally {
      setBusy(false);
    }
  }
  if (resource.error)
    return <MilestoneError message={resource.error} reload={resource.reload} />;
  const milestone = resource.data;
  if (!milestone) return <p role="status">Đang tải chi tiết mốc…</p>;
  const unfinished = milestone.tasks.filter(
    (task) => !['DONE', 'CANCELLED'].includes(task.status),
  );
  const canCancel =
    (access.canManage && milestone.status === 'DRAFT') ||
    (access.canReview &&
      ['ACTIVE', 'CHANGES_REQUESTED'].includes(milestone.status));
  return (
    <section className={panelClass + ' space-y-5'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="break-words text-xl font-bold">{milestone.title}</h3>
          <p className="mt-2 text-sm text-accent">
            {milestoneLabels[milestone.status]}
          </p>
        </div>
        <Button kind="ghost" size="sm" onClick={() => void changed()}>
          Làm mới chi tiết
        </Button>
      </div>
      {message && (
        <p role="status" className="rounded-xl bg-panel p-3 text-sm">
          {message}
        </p>
      )}
      <div>
        <h4 className="mb-2 text-sm font-semibold">
          {milestone.status === 'DRAFT'
            ? 'Tiêu chí đề xuất'
            : 'Tiêu chí đã xác nhận'}
        </h4>
        <ul className="list-inside list-disc space-y-2 text-sm">
          {milestone.criteria.map((criterion, index) => (
            <li key={index} className="break-words">
              {criterion}
            </li>
          ))}
        </ul>
      </div>
      {milestone.tasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Nhiệm vụ liên kết</h4>
          {milestone.tasks.map((task) => (
            <a
              key={task.id}
              href={'/tasks/' + task.id}
              className="block text-sm text-accent"
            >
              TSK-{task.id} · {task.name}
              {['DONE', 'CANCELLED'].includes(task.status)
                ? ' · Đã xử lý'
                : ' · Chưa xong'}
            </a>
          ))}
        </div>
      )}
      {milestone.status === 'DRAFT' && (
        <div className="flex flex-wrap gap-2">
          {access.canManage && (
            <DraftButton
              storageKey={composerDraftStorageKey(
                user,
                `project:${project}:milestone:${id}:edit:${milestone.version}`,
              )}
              kind="secondary"
              aria-haspopup="dialog"
              onClick={() => setEditing(true)}
            >
              Chỉnh sửa kế hoạch
            </DraftButton>
          )}
          {access.canReview && (
            <Button
              loading={busy}
              onClick={() =>
                void action(
                  'approve-plan',
                  { version: milestone.version },
                  'Đã xác nhận kế hoạch mốc bàn giao.',
                )
              }
            >
              Đồng ý kế hoạch mốc
            </Button>
          )}
        </div>
      )}
      {editing && access.canManage && milestone.status === 'DRAFT' && (
        <ComposerDialog
          user={user}
          scope={`project:${project}:milestone:${id}:edit:${milestone.version}`}
          title="Chỉnh sửa kế hoạch"
          submitLabel="Lưu kế hoạch"
          onClose={() => setEditing(false)}
        >
          <MilestonePlanForm
            key={milestone.version}
            user={user}
            project={project}
            tasks={tasks}
            milestone={milestone}
            onSaved={async () => {
              setEditing(false);
              await changed();
            }}
          />
        </ComposerDialog>
      )}
      {access.canManage &&
        ['ACTIVE', 'CHANGES_REQUESTED'].includes(milestone.status) && (
          <div className="space-y-3 border-t border-line pt-4">
            {unfinished.length > 0 && (
              <p className="text-sm text-warning">
                Còn {unfinished.length} nhiệm vụ liên kết chưa xử lý xong.
              </p>
            )}
            <ComposerEntry
              user={user}
              scope={`project:${project}:milestone:${id}:delivery:${milestone.version}`}
              title="Gửi kết quả nghiệm thu"
              submitLabel="Gửi khách hàng nghiệm thu"
              disabled={unfinished.length > 0}
            >
              <DeliveryForm
                key={milestone.version}
                milestone={milestone}
                disabled={unfinished.length > 0}
                onSubmit={(body) =>
                  action(
                    'submissions',
                    body,
                    'Đã gửi kết quả cho khách hàng nghiệm thu.',
                    true,
                    true,
                  )
                }
              />
            </ComposerEntry>
          </div>
        )}
      {milestone.cancelled_reason && (
        <p className="rounded-xl bg-panel p-3 text-sm">
          Lý do hủy · {milestone.cancelled_reason}
        </p>
      )}
      {canCancel && (
        <div className="space-y-3">
          <Button
            kind="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setCancelling((value) => !value)}
          >
            {cancelling ? 'Quay lại' : 'Hủy mốc này'}
          </Button>
          {cancelling && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void action(
                  'cancel',
                  { version: milestone.version, reason },
                  'Đã hủy mốc bàn giao.',
                );
              }}
            >
              <label className="block text-sm">
                Lý do hủy
                <textarea
                  className={inputClass}
                  required
                  maxLength={2000}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <Button type="submit" kind="danger" loading={busy}>
                Xác nhận hủy mốc
              </Button>
            </form>
          )}
        </div>
      )}
      <div className="space-y-4 border-t border-line pt-4">
        <h4 className="text-lg font-semibold">Lịch sử bàn giao</h4>
        {milestone.submissions.map((submission) => (
          <details
            key={submission.id}
            open={submission.id === milestone.latest_submission_id}
            className="rounded-xl border border-line p-4"
          >
            <summary className="cursor-pointer text-sm font-semibold">
              Lần {submission.submission_no} ·{' '}
              {submissionLabels[submission.decision]} ·{' '}
              {dateLabel(submission.submitted_at)}
            </summary>
            <div className="mt-4 space-y-3">
              <p className="text-xs text-muted">
                Người gửi · {submission.submitted_name}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {submission.note}
              </p>
              <a
                href={submission.result_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-semibold text-accent"
              >
                Mở kết quả bàn giao ↗
              </a>
              {submission.reviewed_at && (
                <div className="rounded-xl bg-panel p-3">
                  <p className="text-xs text-muted">
                    {submission.reviewer_name} ·{' '}
                    {dateLabel(submission.reviewed_at)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {submission.feedback ||
                      'Khách hàng đã xác nhận đầy đủ tiêu chí nghiệm thu.'}
                  </p>
                </div>
              )}
              {access.canReview &&
                milestone.status === 'IN_REVIEW' &&
                submission.decision === 'PENDING' &&
                submission.id === milestone.latest_submission_id && (
                  <MilestoneReviewForm
                    key={submission.id}
                    submission={submission}
                    version={milestone.version}
                    busy={busy}
                    onReview={(body) =>
                      action(
                        'submissions/' + submission.id + '/review',
                        body,
                        'Đã lưu phản hồi nghiệm thu.',
                      )
                    }
                  />
                )}
            </div>
          </details>
        ))}
        {!milestone.submissions.length && (
          <p className="text-sm text-muted">
            Đội chưa gửi kết quả cho mốc này.
          </p>
        )}
        <Pagination
          page={page}
          total={milestone.submissionCount}
          size={10}
          onChange={setPage}
        />
      </div>
    </section>
  );
}
function DeliveryForm({
  milestone,
  disabled,
  onSubmit,
}: {
  milestone: Milestone;
  disabled: boolean;
  onSubmit: (body: unknown) => Promise<void>;
}) {
  const [note, setNote] = useComposerField('note', '');
  const [url, setUrl] = useComposerField('url', '');
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ note?: string; url?: string }>({});
  const composer = useComposerStatus(busy, error);
  return (
    <form
      id={composer?.formId}
      noValidate
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        const errors: typeof fieldErrors = {};
        if (!note.trim()) errors.note = 'Vui lòng điền vào trường này.';
        if (!url.trim()) {
          errors.url = 'Vui lòng điền vào trường này.';
        } else if (!/^https?:\/\//i.test(url.trim())) {
          errors.url = 'Đường dẫn phải bắt đầu bằng http:// hoặc https://';
        }
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
          return;
        }
        setError('');
        setBusy(true);
        void onSubmit({
          note,
          resultUrl: url,
          requestId,
          version: milestone.version,
        })
          .then(() => composer?.complete())
          .catch((error) => setError(errorMessage(error)))
          .finally(() => setBusy(false));
      }}
    >
      <fieldset disabled={disabled || busy} className="space-y-3">
        <legend className="sr-only">Gửi kết quả mốc bàn giao</legend>
        <h4 className="font-semibold">Gửi kết quả nghiệm thu</h4>
        <TextAreaField
          label="Kết quả và hướng dẫn kiểm tra"
          rows={4}
          required
          maxLength={4000}
          value={note}
          error={fieldErrors.note}
          onChange={(event) => {
            setNote(event.target.value);
            if (fieldErrors.note) setFieldErrors((prev) => ({ ...prev, note: undefined }));
          }}
        />
        <TextField
          label="Liên kết kết quả bàn giao"
          type="url"
          required
          maxLength={2048}
          value={url}
          error={fieldErrors.url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (fieldErrors.url) setFieldErrors((prev) => ({ ...prev, url: undefined }));
          }}
          placeholder="https://..."
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {!composer && (
          <Button type="submit" loading={busy}>
            Gửi khách hàng nghiệm thu
          </Button>
        )}
      </fieldset>
    </form>
  );
}
function MilestoneReviewForm({
  submission,
  version,
  busy,
  onReview,
}: {
  submission: MilestoneSubmission;
  version: number;
  busy: boolean;
  onReview: (body: unknown) => Promise<void>;
}) {
  const [checked, setChecked] = useState<number[]>([]);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  function review(accepted: boolean) {
    setError('');
    if (!accepted && !feedback.trim()) {
      setError('Nêu rõ phần cần chỉnh sửa trước khi gửi phản hồi.');
      return;
    }
    void onReview({ accepted, feedback, checkedCriteria: checked, version });
  }
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <h4 className="font-semibold">Phản hồi của khách hàng</h4>
      <fieldset disabled={busy} className="space-y-3">
        <legend className="sr-only">Kiểm tra các tiêu chí</legend>
        {submission.criteria.map((criterion, index) => (
          <label key={index} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={checked.includes(index)}
              onChange={(event) =>
                setChecked((current) =>
                  event.target.checked
                    ? [...current, index]
                    : current.filter((item) => item !== index),
                )
              }
            />
            <span>{criterion}</span>
          </label>
        ))}
        <label className="block text-sm">
          Nhận xét hoặc yêu cầu chỉnh sửa
          <textarea
            className={inputClass}
            maxLength={2000}
            rows={3}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || checked.length !== submission.criteria.length}
            onClick={() => review(true)}
          >
            Chấp nhận mốc bàn giao
          </Button>
          <Button
            kind="secondary"
            disabled={busy}
            onClick={() => review(false)}
          >
            Yêu cầu chỉnh sửa
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
