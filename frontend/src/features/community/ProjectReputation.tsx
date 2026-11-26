import { Icon } from '../../shared/ui/Icon';
import { useComposerField, useComposerStatus } from './composer.state';
import { ComposerEntry } from './ComposerDialog';
import { useEffect, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { useWorkspace } from '../workspace';
import type { MyProjectItem } from '../projects/model/project.types';
import {
  communityRequest,
  dateLabel,
  errorMessage,
  inputClass,
  panelClass,
  useCommunityResource,
  type Engagement,
  type MyTeams,
  type Review,
} from './community.api';

export function ProjectReputation({ project }: { project: MyProjectItem }) {
  const resource = useCommunityResource<Engagement>(
    `projects/${project.id}/reputation`,
  );
  const mine = useCommunityResource<MyTeams>(
    resource.user && project.role === 'Owner' ? 'community/me' : null,
  );
  const workspace = useWorkspace();
  const [teamId, setTeamId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [publish, setPublish] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean; completion: boolean }>();
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const teams =
    mine.data?.teams.filter((team) => team.owner_user_id === resource.user) ??
    [];
  const members =
    workspace.data?.members.filter(
      (member) =>
        member.projectId === project.id && member.id !== resource.user,
    ) ?? [];
  const data = resource.data;
  const reloadEngagement = resource.reload;
  useEffect(() => {
    if (data?.status !== 'COMPLETED' || (!data.isCustomer && !data.isTeamOwner)) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reloadEngagement();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [data?.status, data?.isCustomer, data?.isTeamOwner, reloadEngagement]);

  useEffect(() => {
    if (project.developmentState === 'COMPLETED' && data?.status === 'ACTIVE') {
      window.dispatchEvent(new Event('tasknest:sync'));
    }
  }, [project.developmentState, data?.status]);

  async function action(
    path: string,
    body: unknown,
    success: string,
    propagate = false,
  ) {
    if (busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await communityRequest(
        `projects/${project.id}/reputation${path}`,
        resource.user,
        body,
        'PUT',
      );
      await resource.reload();
      window.dispatchEvent(new Event('tasknest:sync'));
      setMessage({ text: success, failed: false, completion: path === '/complete' });
    } catch (error) {
      setMessage({ text: errorMessage(error), failed: true, completion: path === '/complete' });
      if (propagate) throw error;
    } finally {
      setBusy(false);
    }
  }
  if (resource.error)
    return (
      <div className={panelClass} role="alert">
        <p className="mb-3 text-danger">{resource.error}</p>
        <Button onClick={() => void resource.reload()}>Thử lại</Button>
      </div>
    );
  if (!data) return <p role="status">Đang tải thông tin hợp tác…</p>;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Nghiệm thu & đánh giá</h2>
        <p className="mt-2 text-sm text-muted">
          Liên kết đội thực hiện với khách hàng và ghi nhận kết quả hợp tác.
        </p>
      </div>
      {message && (
        <div role={message.failed ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${message.failed ? 'border-danger/25 bg-danger-soft text-danger' : 'border-accent/25 bg-tint text-ink'}`}>
          <Icon name={message.failed ? 'alert' : 'check'} size={20} />
          <div className="min-w-0 space-y-2">
            {message.completion && <p className="font-bold">{message.failed ? 'Chưa thể nghiệm thu dự án' : 'Nghiệm thu thành công'}</p>}
            <p>{message.text}</p>
            {message.failed && message.completion && (
              <div className="flex flex-wrap gap-3 font-semibold text-accent">
                <a href={`/projects/${project.id}?tab=milestones`}>Kiểm tra mốc bàn giao →</a>
                {!data.isCustomer && <a href={`/projects/${project.id}?tab=tasks`}>Kiểm tra nhiệm vụ →</a>}
              </div>
            )}
          </div>
        </div>
      )}
      {!data.configured ? (
        <section className={panelClass + ' space-y-4'}>
          {project.role === 'Owner' ? (
            <>
              <p className="text-sm text-muted">
                Chọn đội bạn đại diện và một khách hàng đã tham gia dự án. Khách
                hàng sẽ xác nhận thông tin hợp tác trước khi nghiệm thu.
              </p>
              <a
                href="/team-management"
                className="inline-block text-sm font-semibold text-accent"
              >
                Quản lý hồ sơ đội →
              </a>
              {mine.error && (
                <p role="alert" className="text-danger">
                  {mine.error}{' '}
                  <button onClick={() => void mine.reload()}>Thử lại</button>
                </p>
              )}
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(
                    '',
                    { teamId: Number(teamId), customerId },
                    'Đã gửi thông tin hợp tác. Khách hàng có thể xác nhận tại tab này.',
                  );
                }}
              >
                <label className="block text-sm font-medium">
                  Đội thực hiện
                  <select
                    required
                    value={teamId}
                    onChange={(event) => setTeamId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Chọn đội bạn làm chủ</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  Đại diện khách hàng
                  <select
                    required
                    value={customerId}
                    onChange={(event) => setCustomerId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">
                      Chọn thành viên đại diện khách hàng
                    </option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-muted">
                  Khách hàng phải ở ngoài đội thực hiện. Bạn có thể mời khách
                  hàng vào dự án qua tab Thành viên.
                </p>
                <Button
                  type="submit"
                  loading={busy}
                  disabled={!teamId || !customerId}
                >
                  Gửi khách hàng xác nhận
                </Button>
              </form>
            </>
          ) : (
            <p className="text-muted">
              Chủ dự án cần thiết lập đội thực hiện và đại diện khách hàng.
            </p>
          )}
        </section>
      ) : (
        <>
          <section className={panelClass + ' space-y-4 rounded-3xl shadow-panel'}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  <a href={'/teams/' + data.team_id} className="text-accent">
                    {data.team_name}
                  </a>
                </h3>
                <p className="mt-1 text-sm text-muted">
                  Khách hàng · {data.customer_name}
                </p>
              </div>
              <span className="self-start rounded-full bg-tint px-3 py-1 text-xs font-bold text-accent">
                {data.status === 'PROPOSED'
                  ? 'Chờ khách hàng xác nhận'
                  : data.status === 'ACTIVE'
                    ? 'Đang hợp tác'
                    : 'Khách hàng đã nghiệm thu'}
              </span>
            </div>
            {data.isCustomer && data.status === 'PROPOSED' && (
              <div className="space-y-3">
                <p className="text-sm">
                  Xác nhận bạn là đại diện khách hàng và đội trên đang thực hiện
                  dự án này.
                </p>
                <Button
                  loading={busy}
                  onClick={() =>
                    void action('/accept', {}, 'Đã xác nhận hợp tác với đội.')
                  }
                >
                  Xác nhận hợp tác
                </Button>
                <Button
                  kind="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      '/decline',
                      {},
                      'Đã từ chối. Chủ dự án có thể thiết lập lại thông tin hợp tác.',
                    )
                  }
                >
                  Thông tin không đúng, từ chối
                </Button>
              </div>
            )}
            {data.isCustomer && data.status === 'ACTIVE' && (
              <form
                className="space-y-4 border-t border-line pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action(
                    '/complete',
                    { publishProject: publish },
                    'Đã nghiệm thu. Bạn có thể đánh giá đội và ghi nhận thành viên bên dưới.',
                  );
                }}
              >
                <div className="rounded-2xl border border-line bg-panel/60 p-4 text-sm">
                  <h4 className="font-bold">Điều kiện nghiệm thu</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                    <li><a className="font-semibold text-accent" href={`/projects/${project.id}?tab=milestones`}>Mốc bàn giao</a> đã được chấp nhận hoặc thống nhất hủy.</li>
                    <li>Nhiệm vụ đã hoàn thành hoặc hủy, với ít nhất một nhiệm vụ hoàn thành.</li>
                  </ul>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" required className="mt-1" />
                  Tôi xác nhận nghiệm thu dự án.
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={publish}
                    onChange={(event) => setPublish(event.target.checked)}
                    className="mt-1"
                  />
                  Cho phép hiển thị tên dự án trên hồ sơ công khai của đội và
                  thành viên.
                </label>
                <Button type="submit" loading={busy}>
                  Xác nhận nghiệm thu
                </Button>
              </form>
            )}
          </section>
          {data.status === 'COMPLETED' && (
            <section aria-label="Mở lại dự án" className={panelClass + ' space-y-3'}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">Tiếp tục dự án</h3>
                <span className="rounded-full bg-tint px-3 py-1 text-xs font-semibold text-accent">Đã hoàn thành</span>
              </div>
              <p className="text-sm text-muted">Dự án đang ở chế độ chỉ xem. Khách hàng và chủ đội cần đồng ý để tiếp tục giao việc và cập nhật bàn giao.</p>
              {data.reopenRequest && (
                <p className="rounded-xl bg-panel p-3 text-sm">
                  {data.reopenRequest.requestedByMe
                    ? 'Đã gửi yêu cầu. Đang chờ bên còn lại phản hồi.'
                    : (data.reopenRequest.fromCustomer ? 'Khách hàng' : 'Chủ đội') + ' đã yêu cầu mở lại dự án.'}
                </p>
              )}
              {project.status === 'ACTIVE' && (data.isCustomer || data.isTeamOwner) && (
                <div className="flex flex-wrap gap-2">
                  {!data.reopenRequest ? (
                    <Button kind="secondary" loading={busy}
                      onClick={() => void action('/reopen', { action: 'REQUEST' }, 'Đã gửi yêu cầu mở lại. Dự án sẽ mở khi bên còn lại đồng ý.')}>
                      Yêu cầu mở lại
                    </Button>
                  ) : data.reopenRequest.requestedByMe ? (
                    <Button kind="secondary" loading={busy}
                      onClick={() => void action('/reopen', { action: 'CANCEL', requestId: data.reopenRequest?.id }, 'Đã rút yêu cầu mở lại dự án.')}>
                      Rút yêu cầu
                    </Button>
                  ) : (
                    <>
                      <Button loading={busy}
                        onClick={() => void action('/reopen', { action: 'APPROVE', requestId: data.reopenRequest?.id }, 'Hai bên đã đồng ý. Dự án đã mở lại.')}>
                        Đồng ý mở lại
                      </Button>
                      <Button kind="secondary" disabled={busy}
                        onClick={() => void action('/reopen', { action: 'DECLINE', requestId: data.reopenRequest?.id }, 'Đã từ chối. Dự án vẫn ở trạng thái đã hoàn thành.')}>
                        Từ chối
                      </Button>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
          {(data.status === 'COMPLETED' || data.review) && (
            <>
              {data.isCustomer && (data.review ? data.status === 'ACTIVE' && project.status === 'ACTIVE' : data.status === 'COMPLETED') && (
                <ComposerEntry
                  user={resource.user!}
                  scope={`project:${project.id}:review:${data.review?.version ?? 'new'}`}
                  title={data.review ? 'Cập nhật đánh giá của bạn' : 'Đánh giá đội thực hiện'}
                  submitLabel={data.review ? 'Cập nhật đánh giá' : 'Đăng đánh giá'}
                >
                  <ReviewForm review={data.review}
                    busy={busy}
                    onSave={(body) =>
                      action(
                        '/review',
                        body,
                        'Đã công khai đánh giá của bạn trên hồ sơ đội.',
                        true,
                      )
                    }
                  />
                </ComposerEntry>
              )}
              {data.review && (
                <section className={panelClass + ' space-y-3'}>
                  <h3 className="font-semibold">Nhận xét của khách hàng</h3>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {data.review.comment}
                  </p>
                  <p className="text-xs text-muted">
                    Chất lượng {data.review.quality}/5 · Tiến độ{' '}
                    {data.review.schedule}/5 · Giao tiếp{' '}
                    {data.review.communication}/5 · Hỗ trợ {data.review.support}
                    /5
                  </p>
                  {data.review.reply && (
                    <div className="rounded-xl bg-panel p-3 text-sm">
                      <p className="mb-1 font-semibold">Phản hồi từ đội</p>
                      <p className="whitespace-pre-wrap break-words">
                        {data.review.reply}
                      </p>
                    </div>
                  )}
                  {data.isTeamOwner && data.status === 'ACTIVE' && project.status === 'ACTIVE' && (
                    <ComposerEntry
                      user={resource.user!}
                      scope={`project:${project.id}:reply:${data.review.version}`}
                      title={'Phản hồi đánh giá'}
                      submitLabel={'Lưu phản hồi'}
                    >
                      <ReplyForm
                        key={data.review.version}
                        review={data.review}
                        busy={busy}
                        onSave={(body) =>
                          action(
                            '/reply',
                            body,
                            'Đã lưu phản hồi của đội.',
                            true,
                          )
                        }
                      />
                    </ComposerEntry>
                  )}
                </section>
              )}
              <button
                type="button"
                className="text-sm font-semibold text-accent"
                onClick={() => setHistoryOpen((value) => !value)}
              >
                {historyOpen
                  ? 'Ẩn lịch sử chỉnh sửa'
                  : 'Xem lịch sử đánh giá và phản hồi'}
              </button>
              {historyOpen && <ReviewHistory project={project.id} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
function ReviewForm({
  review,
  busy,
  onSave,
}: {
  review?: Review | null;
  busy: boolean;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [scores, setScores] = useComposerField('scores', {
    quality: review?.quality ?? 0,
    schedule: review?.schedule ?? 0,
    communication: review?.communication ?? 0,
    support: review?.support ?? 0,
  });
  const [comment, setComment] = useComposerField(
    'comment',
    review?.comment ?? '',
  );
  const [rehire, setRehire] = useComposerField(
    'rehire',
    review?.would_rehire ?? true,
  );
  const [error, setError] = useState('');
  const composer = useComposerStatus(busy, error);
  async function save(body: unknown) {
    if (busy) return;
    setError('');
    try {
      await onSave(body);
      composer?.complete();
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  const labels = {
    quality: 'Chất lượng sản phẩm',
    schedule: 'Tiến độ theo thỏa thuận',
    communication: 'Giao tiếp',
    support: 'Hỗ trợ bàn giao',
  };
  return (
    <form
      id={composer?.formId}
      className={(composer ? '' : panelClass) + ' space-y-4'}
      onSubmit={(event) => {
        event.preventDefault();
        void save({
          ...scores,
          comment,
          wouldRehire: rehire,
          version: review?.version,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(labels) as Array<keyof typeof labels>).map(key => (
          <fieldset key={key} disabled={busy} className="relative min-w-0 rounded-2xl border border-line bg-panel/40 p-3 pt-8">
            <legend className="absolute top-3 px-0 text-sm font-semibold">{labels[key]}</legend>
            <div className="mt-1 flex items-center">
              {[1, 2, 3, 4, 5].map(score => (
                <label key={score} className="cursor-pointer">
                  <input type="radio" required name={key} value={score} checked={scores[key] === score}
                    onChange={() => setScores(current => ({ ...current, [key]: score }))} className="peer sr-only" />
                  <span aria-hidden="true" className={`grid size-9 place-items-center rounded-lg text-2xl transition-colors hover:bg-tint peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${score <= scores[key] ? 'text-amber-600 dark:text-amber-300' : 'text-muted'}`}>
                    {score <= scores[key] ? '★' : '☆'}
                  </span>
                  <span className="sr-only">{score} sao</span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">{scores[key] ? scores[key] + '/5 sao' : 'Chọn số sao'}</p>
          </fieldset>
        ))}
      </div>
      <label className="block text-sm">
        Nhận xét công khai
        <textarea
          required
          maxLength={2000}
          rows={4}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className={inputClass}
          placeholder="Chia sẻ trải nghiệm hợp tác và kết quả bàn giao…"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={rehire}
          onChange={(event) => setRehire(event.target.checked)}
        />
        Sẵn sàng hợp tác lại
      </label>
      <p className="text-xs text-muted">
        Tên hiển thị của bạn đi cùng đánh giá. Lịch sử chỉnh sửa được lưu trong
        dự án.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!composer && (
        <Button type="submit" loading={busy}>
          {review ? 'Cập nhật đánh giá' : 'Đăng đánh giá'}
        </Button>
      )}
    </form>
  );
}
function ReplyForm({
  review,
  busy,
  onSave,
}: {
  review: Review;
  busy: boolean;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [comment, setComment] = useComposerField('comment', review.reply ?? '');
  const [error, setError] = useState('');
  const composer = useComposerStatus(busy, error);
  async function save(body: unknown) {
    if (busy) return;
    setError('');
    try {
      await onSave(body);
      composer?.complete();
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  return (
    <form
      id={composer?.formId}
      className={composer ? 'space-y-3' : 'space-y-3 border-t border-line pt-3'}
      onSubmit={(event) => {
        event.preventDefault();
        void save({ comment, version: review.version });
      }}
    >
      <label className="block text-sm">
        Phản hồi công khai của đội
        <textarea
          required
          maxLength={2000}
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!composer && (
        <Button type="submit" loading={busy}>
          Lưu phản hồi
        </Button>
      )}
    </form>
  );
}
function ReviewHistory({ project }: { project: string }) {
  type Entry = {
    id: number;
    created_at: string;
    content: string | Record<string, unknown>;
  };
  const resource = useCommunityResource<Entry[]>(
    `projects/${project}/reputation/history`,
  );
  if (resource.error)
    return (
      <p role="alert" className="text-danger">
        {resource.error}
      </p>
    );
  if (!resource.data) return <p role="status">Đang tải lịch sử…</p>;
  return (
    <div className={panelClass + ' space-y-4'}>
      {resource.data.length ? (
        resource.data.map((entry) => {
          let value: Record<string, unknown>;
          try {
            value =
              typeof entry.content === 'string'
                ? JSON.parse(entry.content)
                : entry.content;
          } catch {
            return <p key={entry.id}>Không thể hiển thị phiên bản này.</p>;
          }
          return (
            <article
              key={entry.id}
              className="border-b border-line pb-3 last:border-0"
            >
              <p className="mb-2 text-xs text-muted">
                Phiên bản {Number(value.version) + 1} ·{' '}
                {dateLabel(entry.created_at)}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {String(value.comment ?? '')}
              </p>
              {typeof value.reply === 'string' && value.reply && (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
                  Phản hồi của đội · {value.reply}
                </p>
              )}
            </article>
          );
        })
      ) : (
        <p className="text-sm text-muted">Chưa có đánh giá.</p>
      )}
    </div>
  );
}
