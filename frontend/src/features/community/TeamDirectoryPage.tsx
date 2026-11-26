import { MemberCover, TeamCover } from './TeamCover';
import { Icon } from '../../shared/ui/Icon';
import { Modal } from '../../shared/ui/Modal';
import { TeamOverview } from './AreaOverviews';
import { ConnectionActions } from './ConnectionsPage';
import { DiscoveryFeed } from './DiscoveryFeed';
import { TeamMembersPanel } from './TeamMembersPanel';
import { DraftButton } from './DraftButton';
import { composerDraftStorageKey } from './draftStorage';
import { useComposerField, useComposerStatus } from './composer.state';
import { ComposerDialog, ComposerEntry } from './ComposerDialog';
import { ProfileHero } from '../profile/components/ProfileHero';
import { UserAvatar } from '../profile/components/UserAvatar';
import { Pagination } from './CommunityPagination';
import { MarketplacePage } from './MarketplacePage';
import { DiscoveryNavigation } from './DiscoveryNavigation';
import { RecruitmentBoard, MyApplications } from './TeamRecruitment';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { TextAreaField } from '../../shared/ui/TextAreaField';
import { useSession } from '../auth';
import { navigateTo } from '../../app/router/location';
import { PublicProfessionalProfile } from '../profile/components/PublicProfessionalProfile';
import { ChatLink } from '../messaging/ChatLink';
import {
  communityRequest,
  dateLabel,
  errorMessage,
  inputClass,
  panelClass,
  strengths,
  useCommunityResource,
  type Team,
  type TeamProfile,
  type MemberProfile,
  type MyTeams,
  type Review,
} from './community.api';

export function CommunityPage({ pathname }: { pathname: string }) {
  const teamId = pathname.match(/^\/teams\/([1-9]\d*)$/)?.[1];
  const memberId = pathname.match(/^\/members\/([0-9a-f-]{36})$/)?.[1];
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-8">
      <DiscoveryNavigation pathname={pathname} search={window.location.search} />
      {pathname === '/discovery' ? <DiscoveryFeed /> : pathname === '/requests' || pathname.startsWith('/requests/') ? (
        <MarketplacePage pathname={pathname} />
      ) : teamId ? (
        <TeamDetails id={teamId} />
      ) : memberId ? (
        <MemberDetails id={memberId} />
      ) : (
        <TeamDirectory />
      )}
    </div>
  );
}

export function TeamManagementPage({ pathname }: { pathname: string }) {
  const id = pathname.match(/^\/team-management\/([1-9]\d*)$/)?.[1];
  return <div className="mx-auto max-w-7xl space-y-5">{id ? <TeamDetails id={id} manage /> : <TeamDirectory manage />}</div>;
}

function Status({
  error,
  loading,
  retry,
  children,
}: {
  error?: string;
  loading: boolean;
  retry: () => unknown;
  children: ReactNode;
}) {
  if (error)
    return (
      <div role="alert" className={panelClass}>
        <p className="mb-3 text-danger">{error}</p>
        <Button onClick={() => void retry()}>Thử lại</Button>
      </div>
    );
  if (loading)
    return (
      <p role="status" className="py-6 text-muted">
        Đang tải…
      </p>
    );
  return children;
}
function TeamDirectory({ manage = false }: { manage?: boolean }) {
  const skill = (new URLSearchParams(window.location.search).get('skill') ?? '').slice(0, 300);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [legacyView] = useState(
    ['mine', 'recruiting', 'applications'].includes(
      new URLSearchParams(window.location.search).get('view') ?? '',
    )
      ? new URLSearchParams(window.location.search).get('view')!
      : 'all',
  );
  const view = manage ? 'mine' : legacyView;
  const resource = useCommunityResource<{ items: Team[]; total: number }>(
    view === 'mine' ? null : `community/teams?search=${encodeURIComponent(query)}&page=${page}&skill=${encodeURIComponent(skill)}`,
  );
  const mine = useCommunityResource<MyTeams>(
    resource.user && view === 'mine' ? 'community/me' : null,
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function respond(team: number, value: boolean) {
    setBusy(true);
    setMessage('');
    try {
      await communityRequest(
        `community/teams/${team}/invitation`,
        resource.user,
        { value },
        'PUT',
      );
      await mine.reload();
      window.dispatchEvent(new Event('tasknest:sync'));
      setMessage(
        value
          ? 'Bạn đã tham gia đội. Tên của bạn sẽ xuất hiện trên hồ sơ đội.'
          : 'Đã từ chối lời mời.',
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const list = view === 'mine' ? mine.data?.teams : resource.data?.items;
  const ownedFirst = view === 'mine' ? [...(list ?? [])].sort((a, b) =>
    Number(b.owner_user_id === resource.user) - Number(a.owner_user_id === resource.user)) : list;
  const isMine = view === 'mine';
  if (view === 'recruiting' || view === 'applications')
    return (
      <>
        {view === 'applications' && <a className="text-sm text-accent" href="/teams?view=recruiting">← Tìm vị trí</a>}
        {view === 'recruiting' ? <RecruitmentBoard /> : <MyApplications />}
      </>
    );
  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-tint via-panel to-surface px-5 py-6 shadow-panel sm:px-6 sm:py-5">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full bg-accent/5 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-accent">{isMine ? 'Không gian của bạn' : 'Cộng đồng TaskNest'}</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{isMine ? 'Đội phát triển của tôi' : 'Tìm đội phát triển'}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">
              {isMine ? 'Quản lý hồ sơ đội, theo dõi khả năng nhận việc và cập nhật thông tin để khách hàng dễ tìm thấy bạn.' : 'Xem chuyên môn và đánh giá của từng đội. Mở hồ sơ đội để trao đổi về dự án của bạn.'}
            </p>
          </div>
          {!isMine && (
            <a className="inline-flex min-h-10 items-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent" href={resource.user ? '/requests?view=mine&compose=1' : '/login?returnTo=%2Frequests%3Fview%3Dmine%26compose%3D1'}>
              Đăng yêu cầu dự án
            </a>
          )}
          {isMine && resource.user && (
            <ComposerEntry
              user={resource.user}
              scope="team:new"
              title="Tạo hồ sơ đội"
              submitLabel="Tạo hồ sơ đội"
            >
              <TeamForm
                user={resource.user}
                onSaved={(id) => navigateTo('/team-management/' + id)}
              />
            </ComposerEntry>
          )}
        </div>
      </section>
      {manage && <TeamOverview />}
      {!!skill && !isMine && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="max-w-full break-words rounded-lg bg-tint px-3 py-1 font-semibold text-accent">#{skill}</span>
          <a className="font-semibold text-accent underline" href="/teams">Bỏ lọc kỹ năng</a>
        </div>
      )}
      {!manage && isMine && resource.user && (
        <a href="/team-management" className="button secondary">Mở khu Quản lý đội →</a>
      )}
      {mine.error && (
        <p role="alert" className="text-danger">
          {mine.error}{' '}
          <button onClick={() => void mine.reload()}>Thử lại</button>
        </p>
      )}
      {mine.data?.invitations.map((invitation) => (
        <div key={invitation.team_id} className={panelClass}>
          <p className="mb-2">
            Bạn được mời tham gia{' '}
            <a
              className="font-semibold text-accent"
              href={'/teams/' + invitation.team_id}
            >
              {invitation.name}
            </a>
            .
          </p>
          <p className="mb-3 text-sm text-muted">
            Chấp nhận sẽ công khai tên của bạn trong danh sách thành viên đội.
          </p>
          <div className="flex gap-2">
            <Button
              disabled={busy}
              onClick={() => void respond(invitation.team_id, true)}
            >
              Chấp nhận
            </Button>
            <Button
              kind="secondary"
              disabled={busy}
              onClick={() => void respond(invitation.team_id, false)}
            >
              Từ chối
            </Button>
          </div>
        </div>
      ))}
      {message && <p role="status">{message}</p>}
      {view === 'all' && (
        <form
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-panel sm:flex-row sm:items-end sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search);
            setPage(0);
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="team-directory-search" className="mb-2 block text-xs font-semibold text-ink">Tìm đội theo tên hoặc kỹ năng</label>
            <input
              id="team-directory-search"
              aria-label="Tên đội hoặc kỹ năng"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
              className={inputClass + ' min-h-11'}
              placeholder="Ví dụ: thiết kế sản phẩm, React, ứng dụng di động…"
            />
          </div>
          <Button type="submit" icon="search" className="w-full sm:w-auto">Tìm đội</Button>
        </form>
      )}
      {view === 'all' && resource.data && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
          <p className="font-semibold">Đội phát triển <span className="ml-1 rounded-full bg-tint px-2 py-0.5 text-xs font-semibold text-accent">{resource.data.total}</span></p>
          <p className="text-xs text-muted">Hồ sơ công khai · Có thể liên hệ trực tiếp</p>
        </div>
      )}
      <Status
        error={view === 'mine' ? mine.error : resource.error}
        loading={
          view === 'mine' ? !mine.data : !resource.data
        }
        retry={view === 'mine' ? mine.reload : resource.reload}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ownedFirst?.map((team) => (
            <a
              key={team.id}
              href={(isMine ? '/team-management/' : '/teams/') + team.id}
              className={panelClass + ' group flex min-h-[270px] flex-col gap-4 rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg'}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-bold tracking-tight group-hover:text-accent">{team.name}</h2>
                  {isMine && <p className="text-xs font-semibold text-accent">{team.owner_user_id === resource.user ? 'Bạn quản lý' : 'Bạn là thành viên'}</p>}
                  <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-muted">{team.description || 'Đội chưa thêm phần giới thiệu.'}</p>
                </div>
                <span className={'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ' + (team.accepting_work ? 'bg-success-soft text-success' : 'bg-panel text-muted')}>
                  {team.accepting_work ? 'Đang nhận việc' : 'Đang bận'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(team.skills || 'Chưa cập nhật chuyên môn').split(',').map((skill) => (
                  <span key={skill.trim()} className="rounded-full border border-line bg-panel px-2.5 py-1 text-xs text-muted">{skill.trim()}</span>
                ))}
              </div>
              {view === 'all' && (
                <div className="mt-auto flex items-center gap-3 border-t border-line pt-3 text-xs">
                  <span className="font-semibold text-ink">{team.rating == null ? 'Chưa có đánh giá' : `★ ${Number(team.rating).toFixed(1)} (${team.review_count})`}</span>
                  <span className="text-muted">♥ {team.likes} lượt thích</span>
                  <span className="ml-auto inline-flex items-center gap-1 font-semibold text-accent">Xem hồ sơ <span aria-hidden="true">→</span></span>
                </div>
              )}
            </a>
          ))}
        </div>
        {list?.length === 0 && (
          <div className={panelClass + ' rounded-2xl px-6 py-12 text-center'}>
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-tint text-accent">⌕</span>
            <h2 className="font-semibold">{isMine ? 'Bạn chưa tham gia đội nào' : 'Chưa tìm thấy đội phù hợp'}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{isMine ? 'Tạo đội của bạn hoặc tìm vị trí đang tuyển để tham gia.' : 'Thử rút gọn từ khóa hoặc tìm theo kỹ năng khác để xem thêm hồ sơ đội.'}</p>
          </div>
        )}
        {view === 'all' && (
          <Pagination
            page={page}
            total={resource.data?.total ?? 0}
            size={12}
            onChange={setPage}
          />
        )}
      </Status>
    </>
  );
}
function TeamForm({
  user,
  team,
  onSaved,
}: {
  user: string;
  team?: Team;
  onSaved: (id: number) => void;
}) {
  const [name, setName] = useComposerField('name', team?.name ?? '');
  const [description, setDescription] = useComposerField(
    'description',
    team?.description ?? '',
  );
  const [skills, setSkills] = useComposerField('skills', team?.skills ?? '');
  const [accepting, setAccepting] = useComposerField(
    'accepting',
    team?.accepting_work ?? true,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    description?: string;
  }>({});
  const composer = useComposerStatus(busy, error);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const errors: typeof fieldErrors = {};
    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = 'Vui lòng điền vào trường này.';
    } else if (trimmedName.length < 3) {
      errors.name = 'Tên đội phải có ít nhất 3 ký tự.';
    }
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      errors.description = 'Vui lòng điền vào trường này.';
    } else if (trimmedDesc.length < 10) {
      errors.description = 'Giới thiệu đội cần tối thiểu 10 ký tự.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = await communityRequest<number>(
        'community/teams' + (team ? '/' + team.id : ''),
        user,
        {
          name,
          description,
          skills,
          acceptingWork: accepting,
          version: team?.version,
        },
        team ? 'PUT' : 'POST',
      );
      composer?.complete();
      if (!team) window.dispatchEvent(new Event('tasknest:sync'));
      onSaved(team?.id ?? id);
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
      onSubmit={(event) => void submit(event)}
      className={(composer ? '' : panelClass) + ' space-y-4'}
    >
      <h2 className="text-lg font-semibold">
        {team ? 'Chỉnh sửa hồ sơ đội' : 'Tạo hồ sơ đội công khai'}
      </h2>
      <TextField
        label="Tên đội"
        required
        maxLength={100}
        value={name}
        error={fieldErrors.name}
        onChange={(event) => {
          setName(event.target.value);
          if (fieldErrors.name)
            setFieldErrors((prev) => ({ ...prev, name: undefined }));
        }}
      />
      <TextAreaField
        label="Giới thiệu"
        required
        maxLength={1500}
        rows={4}
        value={description}
        error={fieldErrors.description}
        onChange={(event) => {
          setDescription(event.target.value);
          if (fieldErrors.description)
            setFieldErrors((prev) => ({ ...prev, description: undefined }));
        }}
      />
      <TextField
        label="Chuyên môn"
        maxLength={300}
        value={skills}
        onChange={(event) => setSkills(event.target.value)}
        placeholder="React, Java, thiết kế giao diện…"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={accepting}
          onChange={(event) => setAccepting(event.target.checked)}
        />
        Đang nhận dự án
      </label>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {!composer && (
        <Button type="submit" loading={busy}>
          Lưu hồ sơ
        </Button>
      )}
    </form>
  );
}
function LikeButton({
  type,
  id,
  liked,
  count,
  onChanged,
}: {
  type: 'TEAM' | 'MEMBER';
  id: string;
  liked: boolean;
  count: number;
  onChanged: () => unknown;
}) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function change() {
    if (session.status !== 'authenticated') {
      navigateTo(
        '/login?returnTo=' + encodeURIComponent(window.location.pathname),
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      await communityRequest(
        `community/likes/${type}/${id}`,
        session.user.id,
        { value: !liked },
        'PUT',
      );
      await onChanged();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button
        kind={liked ? 'primary' : 'secondary'}
        aria-pressed={liked}
        loading={busy}
        onClick={() => void change()}
      >
        {liked ? '♥ Đã thích' : '♡ Thích'} · {count}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
export function ReviewCard({ review }: { review: Review }) {
  return (
    <article className={panelClass + ' space-y-3'}>
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">{review.customer_name}</h3>
        <span className="text-accent">
          ★ {Number(review.rating).toFixed(1)}/5
        </span>
      </div>
      <p className="text-xs text-muted">
        Đã hợp tác ·{' '}
        {review.project_public_name ?? 'Dự án được khách hàng giữ riêng tư'} ·{' '}
        {dateLabel(review.created_at)}
      </p>
      <p className="whitespace-pre-wrap break-words text-sm">
        {review.comment}
      </p>
      <p className="text-xs text-muted">
        Chất lượng {review.quality}/5 · Tiến độ {review.schedule}/5 · Giao tiếp{' '}
        {review.communication}/5 · Hỗ trợ {review.support}/5
      </p>
      {review.would_rehire && (
        <p className="text-sm text-success">Sẵn sàng hợp tác lại</p>
      )}
      {review.reply && (
        <div className="rounded-xl bg-panel p-3">
          <p className="mb-1 text-xs font-semibold">Phản hồi từ đội</p>
          <p className="whitespace-pre-wrap break-words text-sm">
            {review.reply}
          </p>
        </div>
      )}
    </article>
  );
}

function TeamFact({ label, value, icon, detail }: {
  label: string;
  value: string | number;
  icon: 'users' | 'check' | 'message';
  detail?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-tint text-accent">
        <Icon name={icon} size={17} />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted">{label}</dt>
        <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2 font-semibold tabular-nums">
          <span className={typeof value === 'number' ? 'text-lg leading-tight' : 'text-sm'}>{value}</span>
          {detail && <span className="text-xs font-normal text-muted">{detail}</span>}
        </dd>
      </div>
    </div>
  );
}

function TeamDetails({ id, manage = false }: { id: string; manage?: boolean }) {
  const [page, setPage] = useState(0);
  const resource = useCommunityResource<TeamProfile>(
    `community/teams/${id}?page=${page}`,
  );
  const [editing, setEditing] = useState(false);
  const team = resource.data;
  const memberOfTeam = team?.members.some(member => member.user_id === resource.user);
  const [membershipError, setMembershipError] = useState('');
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [membershipTarget, setMembershipTarget] = useState<string>();
  async function changeMembership(memberId?: string) {
    if (membershipBusy) return;
    setMembershipBusy(true);
    setMembershipError('');
    try {
      await communityRequest('community/teams/' + id + (memberId ? '/members/' + memberId : '/membership'), resource.user, undefined, 'DELETE');
      setMembershipTarget(undefined);
      window.dispatchEvent(new Event('tasknest:sync'));
      if (memberId) await resource.reload();
      else navigateTo('/team-management');
    } catch (cause) { setMembershipError(errorMessage(cause)); }
    finally { setMembershipBusy(false); }
  }
  if (manage && team && !memberOfTeam && !team.isOwner)
    return <div role="alert" className={panelClass}>Bạn chưa tham gia đội này. <a className="text-accent underline" href={'/teams/' + id}>Xem hồ sơ công khai</a></div>;
  return (
    <Status error={resource.error} loading={!team} retry={resource.reload}>
      {team && (
        <>
          <a href={manage ? "/team-management" : "/teams"} className="text-sm text-accent">{manage ? "← Quản lý đội" : "← Tìm đội phát triển"}</a>
          <section className={panelClass + ' cover-hero-card relative isolate overflow-hidden !p-0'}>
            <TeamCover key={id} id={id} editor={manage && team.isOwner ? resource.user ?? undefined : undefined}
              coverAction={<LikeButton type="TEAM" id={id} liked={team.liked} count={team.likes} onChanged={resource.reload} />} />
            <div className="relative">
            <div className="grid items-start gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,19rem)]">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className={'inline-flex rounded-full px-3 py-1 text-xs font-semibold ' + (team.accepting_work ? 'bg-success-soft text-success' : 'bg-panel text-muted')}>
                    {team.accepting_work ? 'Đang nhận dự án' : 'Tạm ngừng nhận dự án'}
                  </span>
                </div>
                <h1 className="break-words text-2xl font-bold tracking-tight sm:text-4xl">{team.name}</h1>
                <p className="mt-3 max-w-3xl whitespace-pre-wrap break-words text-sm leading-6 text-muted">
                  {team.description || 'Đội chưa thêm phần giới thiệu.'}
                </p>
                {team.skills && (
                  <ul aria-label="Chuyên môn của đội" className="mt-4 flex flex-wrap gap-2">
                    {[...new Set(team.skills.split(',').map(skill => skill.trim()).filter(Boolean))].map(skill => (
                      <li key={skill} className="max-w-full break-words rounded-lg bg-tint px-2.5 py-1 text-xs font-medium text-accent">{skill}</li>
                    ))}
                  </ul>
                )}
              </div>
              <dl aria-label="Chỉ số đội" className="min-w-0 divide-y divide-line rounded-xl border border-line bg-panel/50">
                <TeamFact label="Thành viên" value={team.member_count} icon="users" />
                <TeamFact label="Dự án đã nghiệm thu" value={team.completed_projects} icon="check" />
                <TeamFact label="Đánh giá khách hàng" icon="message"
                  value={team.rating == null ? 'Chưa có đánh giá' : Number(team.rating).toFixed(1)}
                  detail={team.rating == null ? undefined : `/ 5 · ${team.review_count} đánh giá`} />
              </dl>
            </div>
            <div aria-label="Thao tác với đội" className="flex flex-wrap items-center gap-2.5 border-t border-line/75 px-4 py-3 sm:px-6">
              {manage && memberOfTeam && <ChatLink destination={{ kind: 'team', id }} className="!border-accent !bg-accent !text-on-accent hover:!bg-accent-hover">Chat nội bộ</ChatLink>}
              {resource.user && resource.user !== team.owner_user_id && (
                <ChatLink destination={{ kind: 'user', id: team.owner_user_id }}>Nhắn cho trưởng đội</ChatLink>
              )}
              {manage && team.isOwner && (
                <DraftButton
                  storageKey={resource.user ? composerDraftStorageKey(resource.user, `team:${id}:edit:${team.version}`) : null}
                  kind="secondary" size="sm" className="!min-h-10" aria-haspopup="dialog" onClick={() => setEditing(true)}
                >
                  Chỉnh sửa hồ sơ
                </DraftButton>
              )}
              {(manage || memberOfTeam) && (
                <a href={manage ? '/teams/' + id : '/team-management/' + id}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink hover:border-accent/50 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
                  {manage ? 'Hồ sơ công khai' : 'Quản lý đội'} <span aria-hidden="true">↗</span>
                </a>
              )}
              {manage && memberOfTeam && !team.isOwner && (
                <Button kind="ghost" size="sm" className="!min-h-10 !text-danger" disabled={membershipBusy} onClick={() => setMembershipTarget('self')}>Rời đội</Button>
              )}
              {membershipError && <p role="alert" className="basis-full text-sm text-danger">{membershipError}</p>}
            </div>
            </div>
          </section>
          {editing && resource.user && (
            <ComposerDialog
              user={resource.user!}
              scope={`team:${id}:edit:${team.version}`}
              title="Chỉnh sửa hồ sơ đội"
              submitLabel="Lưu hồ sơ"
              onClose={() => setEditing(false)}
            >
              <TeamForm
                key={team.version}
                user={resource.user}
                team={team}
                onSaved={() => {
                  setEditing(false);
                  void resource.reload();
                }}
              />
            </ComposerDialog>
          )}
          {manage && (
            <nav aria-label="Các phần quản lý đội" className="flex flex-wrap gap-2 rounded-2xl border border-line bg-surface p-2">
              {([
                ['#team-members', 'Thành viên', 'users'],
                ...(team.isOwner ? [['#team-roster', 'Mời và bố trí', 'person']] as const : []),
                ['#team-recruitment', 'Tuyển dụng', 'plus'],
                ['#team-reviews', 'Đánh giá', 'message'],
              ] as const).map(([href, label, icon]) => (
                <a key={href} href={href} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted hover:bg-tint hover:text-accent">
                  <Icon name={icon} size={16} />{label}
                </a>
              ))}
            </nav>
          )}
          <section id="team-members" aria-labelledby="team-members-heading" className="scroll-mt-24">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="team-members-heading" className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
                Thành viên <span className="rounded-full bg-tint px-2.5 py-0.5 text-xs font-semibold text-accent">{team.member_count}</span>
              </h2>
              {manage && team.isOwner && <a href="#team-roster" className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-accent hover:bg-tint">Quản lý nhân sự →</a>}
            </div>
            <div className={manage ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
              {team.members.map(member => {
                const owner = member.user_id === team.owner_user_id;
                const profile = '/members/' + member.user_id + (manage ? '?fromTeam=management' : '?fromTeam=public');
                return (
                  <article key={member.user_id} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-panel hover:border-accent/35 motion-safe:transition motion-safe:duration-200 motion-safe:hover:-translate-y-0.5">
                    <a href={profile} className="group block flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                      <div className="relative h-28 bg-gradient-to-br from-accent/30 via-tint to-panel">
                        <MemberCover userId={member.user_id} own={member.user_id === resource.user} />
                        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent from-30% to-surface" />
                      </div>
                      <div className="relative -mt-11 px-4 pb-4">
                        <UserAvatar userId={member.user_id} name={member.display_name} teamId={manage && memberOfTeam ? id : undefined} publicProfile
                          className="!size-16 border-4 border-surface shadow-sm" />
                        <div className="mt-2.5 flex flex-col items-start gap-1.5">
                          <h3 className="break-words text-base font-bold tracking-tight group-hover:text-accent">{member.display_name}</h3>
                          {owner && <span className="rounded-full bg-tint px-2 py-0.5 text-xs font-semibold text-accent">Trưởng đội</span>}
                        </div>
                        {member.specialty && <p className="mt-1 break-words text-sm text-muted">{member.specialty}</p>}
                        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                          <span><strong className="text-ink">{member.likes}</strong> lượt thích</span>
                          <span><strong className="text-ink">{member.recognitions}</strong> ghi nhận từ khách hàng</span>
                        </p>
                      </div>
                    </a>
                    {manage && (
                      <div className="flex items-center gap-1.5 border-t border-line bg-panel/45 px-3 py-2.5">
                        <a href={profile} className="mr-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-accent hover:bg-tint">
                          <Icon name="person" size={14} /> Xem hồ sơ
                        </a>
                        {resource.user && resource.user !== member.user_id && Boolean(member.can_message) && (
                          <ChatLink destination={{ kind: 'user', id: member.user_id }} iconOnly title="Nhắn tin" className="!size-10 !shrink-0 !p-0">Nhắn tin</ChatLink>
                        )}
                        {team.isOwner && !owner && (
                          <Button kind="ghost" size="sm" icon="close" className="!size-10 !shrink-0 !p-0 !text-danger hover:!bg-danger/10" title="Gỡ khỏi đội" disabled={membershipBusy}
                            onClick={() => setMembershipTarget(member.user_id)}><span className="sr-only">Gỡ {member.display_name} khỏi đội</span></Button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
          {manage && team.isOwner && resource.user && (
            <div id="team-roster" className="scroll-mt-24">
              <TeamMembersPanel team={team} user={resource.user} onChanged={resource.reload} />
            </div>
          )}
          <Modal open={!!membershipTarget} onClose={() => { if (!membershipBusy) setMembershipTarget(undefined); }} title={membershipTarget === 'self' ? 'Rời đội?' : 'Gỡ thành viên?'} description="Quyền và công việc trong các dự án hiện tại được quản lý riêng.">
            <p className="text-sm text-muted">Người rời đội sẽ mất quyền truy cập phòng chat đội và không thể được bố trí vào dự án mới qua đội này.</p>
            {membershipError && <p role="alert" className="mt-2 text-sm text-danger">{membershipError}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button kind="secondary" disabled={membershipBusy} onClick={() => setMembershipTarget(undefined)}>Quay lại</Button>
              <Button kind="danger" loading={membershipBusy} onClick={() => void changeMembership(membershipTarget === 'self' ? undefined : membershipTarget)}>Xác nhận</Button>
            </div>
          </Modal>
          <div id="team-recruitment" className="scroll-mt-24">
            <RecruitmentBoard team={id} owner={manage && team.isOwner} onJoined={resource.reload} />
          </div>
          <section id="team-reviews" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-semibold">Khách hàng đánh giá</h2>
            {team.reviews.length ? (
              team.reviews.map((review) => (
                <ReviewCard key={review.project_id} review={review} />
              ))
            ) : (
              <p className={panelClass + ' text-sm text-muted'}>
                Đánh giá sẽ xuất hiện sau khi khách hàng nghiệm thu và gửi nhận
                xét.
              </p>
            )}
            <Pagination
              page={page}
              total={team.review_count}
              size={10}
              onChange={setPage}
            />
          </section>
        </>
      )}
    </Status>
  );
}
function MemberDetails({ id }: { id: string }) {
  const [page, setPage] = useState(0);
  const [avatarRevision, refreshAvatar] = useState(0);
  const resource = useCommunityResource<MemberProfile>(
    `community/members/${id}?page=${page}`,
  );
  const member = resource.data;
  const params = new URLSearchParams(location.search);
  const teamContext = params.get('fromTeam');
  const project = params.get('project');
  const projectId = project && /^\d{1,19}$/.test(project) ? project : undefined;
  return (
    <Status error={resource.error} loading={!member} retry={resource.reload}>
      {member && (
        <>
          <a href="/teams" className="text-sm text-accent">
            ← Khám phá đội dev
          </a>
          <ProfileHero key={id} userId={id} name={member.display_name} projectId={projectId} avatarRevision={avatarRevision}
            coverAction={!member.connectionOnly && <LikeButton type="MEMBER" id={id} count={member.likes} liked={member.liked} onChanged={resource.reload} />}
            headline={member.professional?.headline} subtitle={<>
            <p>{member.completedProjects ?? 0} dự án đã đóng góp · {member.recognitionCount} ghi nhận từ khách hàng</p>
          </>}>
            <div className="flex flex-wrap items-center gap-2">
              {resource.user && resource.user !== id && (
                <>
                  {!teamContext && <ChatLink destination={{ kind: 'user', id }}>Nhắn tin</ChatLink>}
                  <ConnectionActions userId={id} onChanged={() => refreshAvatar(value => value + 1)} whenFriends={teamContext === 'management'
                    ? <ChatLink destination={{ kind: 'user', id }}>Nhắn tin</ChatLink>
                    : undefined} />
                </>
              )}
            </div>
          </ProfileHero>
          {resource.user === id && (
            <a
              href="/profile"
              className="inline-block text-sm font-semibold text-accent"
            >
              Chỉnh sửa hồ sơ nghề nghiệp →
            </a>
          )}
          {member.professional && (
            <PublicProfessionalProfile profile={member.professional} />
          )}
          <h2 className="text-xl font-semibold">Đội đang tham gia</h2>
          <div className="flex flex-wrap gap-3">
            {member.teams.map((team) => (
              <a
                key={team.id}
                className="rounded-xl border border-line px-4 py-2 text-sm text-accent"
                href={'/teams/' + team.id}
              >
                {team.name}
              </a>
            ))}
          </div>
          {!member.teams.length && (
            <p className="text-sm text-muted">Chưa tham gia đội công khai.</p>
          )}
          <h2 className="text-xl font-semibold">Ghi nhận đóng góp</h2>
          {member.recognitions.map((item, index) => (
            <article key={index} className={panelClass + ' space-y-3'}>
              <p className="font-semibold">
                {item.customer_name}{' '}
                <span className="text-xs font-normal text-muted">
                  · Đã hợp tác · {dateLabel(item.updated_at)}
                </span>
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {item.comment}
              </p>
              <div className="flex flex-wrap gap-2">
                {item.strengths.split(',').map((strength) => (
                  <span
                    key={strength}
                    className="rounded-lg bg-panel px-3 py-1 text-xs"
                  >
                    {strengths[strength as keyof typeof strengths]}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted">
                {item.project_public_name ?? 'Dự án riêng tư'} ·{' '}
                <a href={'/teams/' + item.team_id} className="text-accent">
                  {item.team_name}
                </a>
              </p>
            </article>
          ))}
          {!member.recognitions.length && (
            <p className={panelClass + ' text-muted'}>
              Chưa có ghi nhận từ khách hàng.
            </p>
          )}
          <Pagination
            page={page}
            total={member.recognitionCount}
            size={10}
            onChange={setPage}
          />
        </>
      )}
    </Status>
  );
}
