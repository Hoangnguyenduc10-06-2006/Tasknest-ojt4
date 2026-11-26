import { ProposalPlan } from './ProposalPlan';
import { useState } from 'react';
import { Button } from '../../shared/ui/Button';
import {
  communityRequest,
  errorMessage,
  panelClass,
  useCommunityResource,
} from './community.api';
import { money } from './marketplace.api';
import { ChatLink } from '../messaging/ChatLink';
type Agreement = {
  configured: boolean;
  requestId: number;
  proposalId: number;
  version: number;
  kickoffAt: string | null;
  canKickoff: boolean;
  canViewPrivateDiscussion: boolean;
  canDraftMilestone: boolean;
  developmentState?: string;
  milestoneId: number | null;
  snapshot: {
    title: string;
    description: string;
    plan: string;
    amount?: number;
    teamName: string;
    teamId: number;
    endsOn: string;
    startsOn: string;
    customerId: string;
    customerName: string;
  };
  roster: { user_id: string; display_name: string }[];
  candidates: { user_id: string; display_name: string }[];
};
type Revision = {
  version: number;
  created_at: string;
  snapshot: Record<string, unknown>;
};
export function ProjectAgreement({
  project,
  onChanged,
}: {
  project: string;
  onChanged: () => void;
}) {
  const resource = useCommunityResource<Agreement>(
    `projects/${project}/agreement`,
  );
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historyKind, setHistoryKind] = useState<'request' | 'proposal' | null>(null);
  const [due, setDue] = useState('');
  const data = resource.data;
  const history = useCommunityResource<Revision[]>(
    data?.canViewPrivateDiscussion && historyKind
      ? `community/requests/${data.requestId}/history${historyKind === 'proposal' ? '?proposal=' + data.proposalId : ''}`
      : null,
  );
  async function action(kind: 'kickoff' | 'milestone') {
    if (!data || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await communityRequest<number>(
        `projects/${project}/agreement/${kind}`,
        resource.user,
        kind === 'kickoff'
          ? { version: data.version, userIds: selection }
          : {
              dueOn: due || data.snapshot.endsOn,
              requestId: crypto.randomUUID(),
            },
        kind === 'kickoff' ? 'PUT' : 'POST',
      );
      await resource.reload();
      window.dispatchEvent(new Event('tasknest:sync'));
      onChanged();
      if (kind === 'milestone' && result)
        location.href = `/projects/${project}?tab=milestones&milestone=${result}`;
    } catch (error) {
      setError(errorMessage(error));
      await resource.reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  if (resource.error)
    return (
      <div role="alert" className={panelClass}>
        {resource.error}
        <Button kind="ghost" onClick={() => void resource.reload()}>
          Tải lại thoả thuận
        </Button>
      </div>
    );
  if (!data?.configured) return null;
  return (
    <section
      className={panelClass + ' mb-5 space-y-4'}
      aria-label="Thoả thuận hợp tác"
    >
      {resource.refreshError && <p role="status" className="rounded-xl border border-line bg-panel p-3 text-sm text-muted">Chưa thể cập nhật dữ liệu mới. Nội dung đang hiển thị là lần tải thành công gần nhất. <button className="text-accent underline" onClick={() => void resource.reload()}>Thử lại</button></p>}
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Thoả thuận hợp tác</h2>
          <p className="mt-1 text-sm text-muted">
            {data.snapshot.teamName} · Khách hàng: {data.snapshot.customerName}
          </p>
        </div>
        <span className="text-sm text-accent">
          {data.developmentState === 'COMPLETED'
            ? 'Đã nghiệm thu dự án'
            : data.kickoffAt
              ? 'Đã khởi động'
              : 'Chờ chọn nhân sự'}
        </span>
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-accent">
          Xem phạm vi, cách thực hiện và mốc bàn giao
        </summary>
        <div className="mt-3 space-y-3 text-sm">
          <h3 className="font-semibold">{data.snapshot.title}</h3>
          <p className="whitespace-pre-wrap break-words">
            {data.snapshot.description}
          </p>
          <ProposalPlan plan={data.snapshot.plan ?? ''} />
          <p>
            {data.snapshot.startsOn} → {data.snapshot.endsOn}
            {data.snapshot.amount !== undefined
              ? ' · Chi phí dự kiến: ' + money(data.snapshot.amount)
              : ''}
          </p>
          <div className="flex flex-wrap gap-3">
            <a className="text-accent" href={'/requests/' + data.requestId}>
              Yêu cầu gốc ↗
            </a>
            {data.canViewPrivateDiscussion && (
              <a
                className="text-accent"
                href={
                  '/requests/' +
                  data.requestId +
                  '?proposal=' +
                  data.proposalId +
                  '&discussion=1'
                }
              >
                Đề xuất & trao đổi riêng ↗
              </a>
            )}
            <ChatLink destination={{ kind: 'project', id: project }}>
              Phòng dự án
            </ChatLink>
          </div>
          {data.canViewPrivateDiscussion && (
            <div className="flex flex-wrap gap-2">
              <Button kind="ghost" aria-pressed={historyKind === 'proposal'} onClick={() => setHistoryKind('proposal')}>
                Xem lịch sử đề xuất
              </Button>
              <Button kind="ghost" aria-pressed={historyKind === 'request'} onClick={() => setHistoryKind('request')}>
                Xem lịch sử yêu cầu
              </Button>
            </div>
          )}
          {data.canViewPrivateDiscussion && historyKind && (
            history.error ? (
              <p role="alert" className="text-sm text-danger">
                {history.error}{' '}
                <button className="underline" onClick={() => void history.reload()}>Thử lại</button>
              </p>
            ) : !history.data ? (
              <p role="status">Đang tải lịch sử…</p>
            ) : history.data.length === 0 ? (
              <p className="text-muted">Chưa có phiên bản nào được lưu.</p>
            ) : null
          )}
          {data.canViewPrivateDiscussion && history.data?.map((revision) => (
            <div
              key={revision.version}
              className="rounded-xl border border-line p-3"
            >
              <p className="font-semibold">
                Phiên bản {revision.version + 1} ·{' '}
                {new Date(revision.created_at).toLocaleString('vi-VN')}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words">
                {String(
                  historyKind === 'proposal'
                    ? (revision.snapshot.plan ?? '')
                    : (revision.snapshot.description ?? ''),
                )}
              </p>
              <p className="mt-1 text-muted">
                {revision.snapshot.amount
                  ? money(String(revision.snapshot.amount))
                  : ''}
              </p>
            </div>
          ))}
        </div>
      </details>
      {data.canKickoff ? (
        <div className="space-y-3 rounded-xl bg-panel p-4">
          <h3 className="font-semibold">Chọn nhân sự thực hiện</h3>
          <p className="text-xs text-muted">
            Chủ đội, khách hàng và người đã được bố trí giữ quyền vào dự án.
            Chọn thêm thành viên cần thực hiện công việc; các thành viên khác
            của đội không tự có quyền truy cập.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.candidates.map((person) => (
              <label
                key={person.user_id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  disabled={
                    busy ||
                    data.roster.some(
                      (member) => member.user_id === person.user_id,
                    )
                  }
                  checked={
                    selection.includes(person.user_id) ||
                    data.roster.some(
                      (member) => member.user_id === person.user_id,
                    )
                  }
                  onChange={(event) =>
                    setSelection((previous) =>
                      event.target.checked
                        ? [...previous, person.user_id]
                        : previous.filter((id) => id !== person.user_id),
                    )
                  }
                />
                {person.display_name}
              </label>
            ))}
          </div>
          <Button loading={busy} onClick={() => void action('kickoff')}>
            Xác nhận nhân sự & khởi động
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Nhân sự hiện tại:{' '}
          {data.roster.map((person) => person.display_name).join(', ') ||
            'Chủ đội đang chuẩn bị danh sách'}
          .
        </p>
      )}
      {data.canDraftMilestone && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">
            Ngày bàn giao bản nháp
            <input
              type="date"
              value={due || data.snapshot.endsOn}
              onChange={(event) => setDue(event.target.value)}
              className="mt-1 block rounded-xl border border-line bg-field p-2 text-sm"
            />
          </label>
          <Button
            kind="secondary"
            disabled={busy}
            onClick={() => void action('milestone')}
          >
            Tạo mốc nháp từ thoả thuận
          </Button>
          <p className="text-xs text-muted">
            Hai bên cần kiểm tra và xác nhận kế hoạch trước khi bàn giao.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
