import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { Icon } from '../../shared/ui/Icon';
import { Modal } from '../../shared/ui/Modal';
import { UserAvatar } from '../profile/components/UserAvatar';
import {
  communityRequest,
  dateLabel,
  errorMessage,
  inputClass,
  useCommunityResource,
  type TeamProfile,
} from './community.api';

type Candidate = {
  userId: string;
  fullName: string;
  status: 'AVAILABLE' | 'MEMBER' | 'INVITED' | 'CUSTOMER';
};
type Recommendation = Pick<Candidate, 'userId' | 'fullName'> & {
  headline: string;
  openingTitle: string | null;
  matchedSkills: string;
  matchedCount: number;
  requiredCount: number;
};
type Invitation = { user_id: string; display_name: string; expires_at: string };
type TeamProject = { id: number; name: string; memberIds: string[] };
const labels = {
  AVAILABLE: 'Có thể mời',
  MEMBER: 'Đã ở trong đội',
  INVITED: 'Đang chờ phản hồi',
  CUSTOMER: 'Khách hàng của đội',
};
export function TeamMembersPanel({
  team,
  user,
  onChanged,
}: {
  team: TeamProfile;
  user: string;
  onChanged: () => Promise<void>;
}) {
  const [inviting, setInviting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [projectId, setProjectId] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const base = `community/teams/${team.id}`;
  const pending = useCommunityResource<Invitation[]>(base + '/invitations');
  const recommendations = useCommunityResource<Recommendation[]>(base + '/recommendations');
  const projects = useCommunityResource<TeamProject[]>(base + '/projects');
  const candidates = useCommunityResource<Candidate[]>(
    inviting && query.length >= 2
      ? base + '/people?search=' + encodeURIComponent(query)
      : null,
  );
  const project = projects.data?.find((item) => String(item.id) === projectId);
  function openInvite(candidate: Candidate | null = null) {
    setInviting(true);
    setError('');
    setSearch('');
    setQuery('');
    setSelected(candidate);
  }
  async function cancelInvitation(userId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice('');
    try {
      await communityRequest(base + '/invitations/' + userId, user, undefined, 'DELETE');
      await Promise.all([pending.reload(), recommendations.reload()]);
      setNotice('Đã hủy lời mời.');
    } catch (cause) {
      setNotice(errorMessage(cause));
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  function close() {
    if (!busyRef.current) {
      setInviting(false);
      setAssigning(false);
      setError('');
    }
  }
  async function submit(event: FormEvent, kind: 'invite' | 'assign') {
    event.preventDefault();
    if (
      busyRef.current ||
      (kind === 'invite' ? !selected : !project || !members.length)
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await communityRequest(
        base +
          (kind === 'invite'
            ? '/invitations/by-user'
            : `/projects/${projectId}/members`),
        user,
        kind === 'invite' ? { userId: selected!.userId } : { userIds: members },
        'POST',
      );
      setInviting(false);
      setAssigning(false);
      setSelected(null);
      setMembers([]);
      setNotice(
        kind === 'invite'
          ? 'Đã gửi lời mời. Người nhận cần chấp nhận trong Đội của tôi trước khi được bố trí vào dự án.'
          : 'Đã thêm thành viên vào dự án trong Làm việc. Bạn có thể phân công nhiệm vụ cho họ.',
      );
      await Promise.all([pending.reload(), projects.reload(), recommendations.reload(), onChanged()]);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-gradient-to-br from-tint via-panel/60 to-surface p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-accent shadow-sm"><Icon name="users" size={21} /></span>
          <h2 className="text-xl font-bold tracking-tight">Mời và bố trí thành viên</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            icon="plus"
            aria-haspopup="dialog"
            onClick={() => openInvite()}
          >
            Mời thành viên
          </Button>
          <Button
            kind="secondary"
            aria-haspopup="dialog"
            onClick={() => {
              setAssigning(true);
              setError('');
              setProjectId('');
              setMembers([]);
              void projects.reload();
            }}
          >
            Bố trí vào dự án
          </Button>
        </div>
      </div>
      {notice && (
        <p role="status" className="mx-4 mt-4 rounded-xl bg-tint px-4 py-3 text-sm text-accent sm:mx-6">
          {notice}
        </p>
      )}
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.48fr)]">
        <div className="min-w-0 space-y-3">
          <div>
            <h3 className="text-base font-bold">Ứng viên phù hợp</h3>
            <p className="mt-1 text-sm text-muted">Gợi ý dựa trên kỹ năng của đội và các vị trí đang tuyển.</p>
          </div>
          {recommendations.error ? (
            <p role="alert" className="text-sm text-muted">{recommendations.error}{' '}
              <button type="button" className="font-semibold text-accent" onClick={() => void recommendations.reload()}>Thử lại</button>
            </p>
          ) : recommendations.data ? (
            recommendations.data.length ? (
              <ul className="grid gap-3">
                {recommendations.data.map(person => {
                  const fit = Math.min(100, Math.round(person.matchedCount / Math.max(1, person.requiredCount) * 100));
                  return (
                    <li key={person.userId}
                      className="rounded-2xl border border-line bg-panel/40 p-4 hover:border-accent/35 motion-safe:transition-colors sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <a href={'/members/' + person.userId} className="flex min-w-0 items-center gap-3 rounded-lg hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                          <UserAvatar userId={person.userId} name={person.fullName} publicProfile className="!size-12 shrink-0 border-2 border-surface shadow-sm" />
                          <span className="min-w-0 break-words">
                            <strong className="block text-base font-bold">{person.fullName}</strong>
                            {person.headline && <span className="mt-0.5 block text-xs leading-5 text-muted">{person.headline}</span>}
                          </span>
                        </a>
                        <span className="grid size-14 shrink-0 place-items-center rounded-full text-accent"
                          style={{ background: 'conic-gradient(currentColor ' + fit + '%, transparent 0)' }}>
                          <span className="grid size-12 place-items-center rounded-full bg-surface text-xs font-bold tabular-nums"
                            aria-label={fit + '% phù hợp'}>{fit}%</span>
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                        <strong>Khớp {person.matchedCount}/{person.requiredCount} kỹ năng</strong>
                        {person.openingTitle && <span className="break-words text-muted">· {person.openingTitle}</span>}
                      </div>
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                        <ul aria-label="Kỹ năng phù hợp" className="flex min-w-0 flex-wrap gap-1.5">
                          {person.matchedSkills.split(', ').map(skill => (
                            <li key={skill} className="max-w-full break-words rounded-full border border-accent/15 bg-surface px-2.5 py-1 text-xs font-medium text-accent">{skill}</li>
                          ))}
                        </ul>
                        <Button size="sm" className="ml-auto" icon="plus" disabled={busy} aria-haspopup="dialog"
                          onClick={() => openInvite({ userId: person.userId, fullName: person.fullName, status: 'AVAILABLE' })}>Mời tham gia</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted">Chưa có hồ sơ đang tìm đội khớp với kỹ năng tuyển dụng.</p>
          ) : <p role="status" className="text-sm text-muted">Đang tìm ứng viên phù hợp…</p>}
        </div>
        <div className="min-w-0 space-y-3 self-start rounded-2xl border border-line bg-panel/50 p-4">
          <h3 className="flex items-center gap-2 font-semibold"><Icon name="clock" size={17} /> Lời mời đang chờ {pending.data?.length ? <span className="ml-1 text-sm text-muted">{pending.data.length}</span> : null}</h3>
          {pending.error ? (
            <p role="alert" className="text-sm text-danger">
              {pending.error}{' '}
              <button onClick={() => void pending.reload()}>Thử lại</button>
            </p>
          ) : !pending.data ? (
            <p role="status" className="text-sm text-muted">
              Đang tải lời mời…
            </p>
          ) : !pending.data.length ? (
            <p className="text-sm text-muted">Không có lời mời đang chờ.</p>
          ) : (
            pending.data.map((item) => (
              <div
                key={item.user_id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <UserAvatar
                  userId={item.user_id}
                  name={item.display_name}
                  publicProfile
                />
                <div className="min-w-0 flex-1 break-words">
                  <p className="text-sm font-semibold">{item.display_name}</p>
                  <p className="text-xs text-muted">
                    Chờ xác nhận · Hết hạn {dateLabel(item.expires_at)}
                  </p>
                </div>
                <Button className="ml-auto" kind="secondary" size="sm" disabled={busy} onClick={() => void cancelInvitation(item.user_id)}>Hủy lời mời</Button>
              </div>
            ))
          )}
        </div>
      </div>
      <Modal
        open={inviting}
        onClose={close}
        title="Mời thành viên vào đội"
        description="Tìm theo tên hoặc nhập đầy đủ email của tài khoản đã xác minh."
        maxWidth="xl"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const value = search.trim();
            if (value.length < 2) return;
            setSelected(null);
            if (value === query) void candidates.reload();
            else setQuery(value);
          }}
        >
          <label className="block text-sm font-medium">
            Tìm tài khoản TaskNest
            <input
              className={inputClass}
              value={search}
              disabled={busy}
              onChange={(event) => {
                setSearch(event.target.value);
                setQuery('');
                setSelected(null);
                setError('');
              }}
              minLength={2}
              maxLength={100}
              required
              placeholder="Tên thành viên hoặc email đầy đủ"
            />
          </label>
          <Button type="submit" kind="secondary" disabled={busy}>
            Tìm tài khoản
          </Button>
        </form>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => void submit(event, 'invite')}
        >
          {query &&
            (candidates.error ? (
              <p role="alert" className="text-sm text-danger">
                {candidates.error}
              </p>
            ) : !candidates.data ? (
              <p role="status">Đang tìm tài khoản…</p>
            ) : candidates.data.length ? (
              <fieldset disabled={busy} className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">
                  Chọn người nhận lời mời
                </legend>
                {candidates.data.map((person) => (
                  <label
                    key={person.userId}
                    className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="invitee"
                      checked={selected?.userId === person.userId}
                      disabled={person.status !== 'AVAILABLE'}
                      onChange={() => setSelected(person)}
                    />
                    <UserAvatar
                      userId={person.userId}
                      name={person.fullName}
                      publicProfile
                    />
                    <span>
                      <span className="block font-semibold">
                        {person.fullName}
                      </span>
                      <span className="text-xs text-muted">
                        {labels[person.status]}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className="text-sm text-muted">
                Không tìm thấy tài khoản đã xác minh phù hợp.
              </p>
            ))}
          {selected && !query && <p className="text-sm">Người nhận · <strong>{selected.fullName}</strong></p>}
          <p className="text-xs text-muted">
            Lời mời có hiệu lực 7 ngày. Người nhận được thông báo và chọn chấp
            nhận hoặc từ chối; gửi lời mời chưa cấp quyền vào đội hay dự án.
          </p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button kind="secondary" disabled={busy} onClick={close}>
              Đóng
            </Button>
            <Button type="submit" disabled={!selected} loading={busy}>
              Gửi lời mời
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={assigning}
        onClose={close}
        title="Bố trí thành viên vào dự án"
        description="Chọn thành viên đã tham gia đội để làm việc trong dự án được liên kết."
        maxWidth="xl"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => void submit(event, 'assign')}
        >
          {projects.error ? (
            <p role="alert" className="text-danger">
              {projects.error}{' '}
              <button type="button" onClick={() => void projects.reload()}>
                Thử lại
              </button>
            </p>
          ) : !projects.data ? (
            <p role="status">Đang tải dự án…</p>
          ) : !projects.data.length ? (
            <p className="text-sm text-muted">
              Đội chưa có dự án hợp tác đang triển khai mà bạn có quyền quản lý.
              Khi khách hàng chọn đội, dự án sẽ xuất hiện tại đây.
            </p>
          ) : (
            <>
              <label className="block text-sm font-medium">
                Dự án của đội
                <select
                  className={inputClass}
                  value={projectId}
                  disabled={busy}
                  required
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setMembers([]);
                  }}
                >
                  <option value="">Chọn dự án</option>
                  {projects.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {project && (
                <fieldset disabled={busy} className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold">
                    Chọn thành viên đội
                  </legend>
                  {team.members.map((member) => {
                    const active = project.memberIds.includes(member.user_id);
                    return (
                      <label
                        key={member.user_id}
                        className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={active || members.includes(member.user_id)}
                          disabled={active}
                          onChange={(event) =>
                            setMembers((current) =>
                              event.target.checked
                                ? [...current, member.user_id]
                                : current.filter((id) => id !== member.user_id),
                            )
                          }
                        />
                        <UserAvatar
                          userId={member.user_id}
                          name={member.display_name}
                          teamId={team.id}
                          publicProfile
                        />
                        <span>
                          <span className="block font-semibold">
                            {member.display_name}
                          </span>
                          {active && (
                            <span className="text-xs text-muted">
                              Đã có trong dự án
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
              {project && (
                <a
                  className="inline-block text-sm font-semibold text-accent"
                  href={'/projects/' + project.id + '?tab=members'}
                >
                  Mở thành viên dự án trong Làm việc →
                </a>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button kind="secondary" disabled={busy} onClick={close}>
              Đóng
            </Button>
            <Button
              type="submit"
              disabled={!project || !members.length}
              loading={busy}
            >
              Thêm vào dự án
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
