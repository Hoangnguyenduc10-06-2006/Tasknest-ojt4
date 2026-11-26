import { PostImagePicker, PostMedia } from './PostMedia';
import { profileLinkError } from '../profile/model/professional-profile';
import { matchingRoleTerms } from '../profile/model/developer-roles';
import { useSession } from '../auth';
import type { ProfessionalProfile } from '../profile/model/professional-profile';
import { useComposerField, useComposerStatus } from './composer.state';
import { ComposerEntry } from './ComposerDialog';
import { useState, type FormEvent } from 'react';
import { Modal } from '../../shared/ui/Modal';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { TextAreaField } from '../../shared/ui/TextAreaField';
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
  computeSkillMatch,
  getSavedMatchingSkills,
  saveMatchingSkills,
} from './skill-matching';

type Page<T> = { items: T[]; total: number };
type ApplicationSummary = { id: number; status: string; version: number };
type Opening = {
  id: number;
  team_id: number;
  team_name: string;
  title: string;
  description: string;
  skills: string;
  work_mode: string;
  weekly_hours: number;
  slots: number;
  filled_slots: number;
  closes_on: string;
  status: string;
  version: number;
  isMember: boolean;
  canEdit?: boolean;
  role_match?: boolean | number;
  reference_url?: string | null;
  image_count?: number;
  myApplication?: ApplicationSummary | null;
};
type Application = ApplicationSummary & {
  opening_id: number;
  user_id: string;
  display_name: string;
  introduction: string;
  skills: string;
  weekly_hours: number;
  feedback: string | null;
  created_at: string;
  reviewed_at: string | null;
  team_id?: number;
  team_name?: string;
  title?: string;
  opening_status?: string;
  closes_on?: string;
};
const modes: Record<string, string> = {
  REMOTE: 'Từ xa',
  HYBRID: 'Kết hợp',
  ONSITE: 'Tại văn phòng',
};
const statuses: Record<string, string> = {
  OPEN: 'Đang tuyển',
  PAUSED: 'Tạm dừng',
  CLOSED: 'Đã đóng',
  PENDING: 'Chờ đội phản hồi',
  ACCEPTED: 'Đã nhận vào đội',
  REJECTED: 'Chưa phù hợp',
  WITHDRAWN: 'Đã rút đơn',
};
const basePath = (opening: Opening | Application) =>
  `community/teams/${opening.team_id}/openings/${'opening_id' in opening ? opening.opening_id : opening.id}`;

function ResourceError({
  message,
  reload,
}: {
  message: string;
  reload: () => Promise<void>;
}) {
  return (
    <div role="alert" className={panelClass}>
      <p className="mb-3 text-danger">{message}</p>
      <Button onClick={() => void reload()}>Thử lại</Button>
    </div>
  );
}

export function RecruitmentBoard({
  team,
  owner = false,
  onJoined,
}: {
  team?: string;
  owner?: boolean;
  onJoined?: () => Promise<void>;
}) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [criteria, setCriteria] = useState<{
    user?: string;
    skills: string;
    weeklyHours: number;
  } | null>(null);
  const [sortByMatch, setSortByMatch] = useState(true);
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user.id : undefined;
  const showSkillPrompt = session.status === 'authenticated' && session.user.accountPurpose !== 'CLIENT' && !owner;
  const profile = useCommunityResource<ProfessionalProfile>(
    showSkillPrompt ? 'community/profile' : null,
  );
  const matching =
    criteria && criteria.user === user
      ? criteria
      : getSavedMatchingSkills(user, profile.data);
  const mySkills = matching.skills;
  const myHours = matching.weeklyHours;
  const profileRoles = [profile.data?.headline ?? '', ...(profile.data?.desired_roles ?? [])];
  const roleTerms = matchingRoleTerms(profileRoles);
  const [mode, setMode] = useState('ALL');
  const [minScore, setMinScore] = useState(0);
  const resource = useCommunityResource<Page<Opening>>(
    team
      ? `community/teams/${team}/openings?page=${page}${communityQueryId('opening') ? '&openingId=' + communityQueryId('opening') : ''}`
      : `community/openings?search=${encodeURIComponent(query)}&page=${page}&skills=${encodeURIComponent(mySkills)}&roles=${encodeURIComponent(roleTerms)}&hours=${myHours}&sort=${sortByMatch ? 'MATCH' : 'NEWEST'}&mode=${mode}&minScore=${minScore}`,
  );
  function setMySkills(skills: string) {
    setCriteria({ user, skills, weeklyHours: myHours });
    setPage(0);
  }
  function setMyHours(weeklyHours: number) {
    setCriteria({ user, skills: mySkills, weeklyHours });
    setPage(0);
  }
  if (resource.error)
    return <ResourceError message={resource.error} reload={resource.reload} />;
  const opportunityCount = resource.data?.total ?? 0;
  const Heading = team ? 'h2' : 'h1';
  return (
    <section className="space-y-5">
      {team && communityQueryId('opening') && (
        <a
          href={'/teams/' + team}
          className="text-sm font-semibold text-accent"
        >
          Xem tất cả vị trí của đội →
        </a>
      )}
      {showSkillPrompt && !mySkills.trim() && (
        <p className="rounded-xl border border-line bg-panel p-3 text-sm text-muted">
          Chưa có kỹ năng để đánh giá độ phù hợp.{' '}
          <a href="/profile" className="font-semibold text-accent">
            Hoàn thiện hồ sơ nghề nghiệp
          </a>{' '}
          {team ? 'để bổ sung kỹ năng của bạn.' : 'hoặc nhập tiêu chí tìm kiếm của bạn.'}
        </p>
      )}
      <header
        className={
          team
            ? 'flex flex-wrap items-center justify-between gap-4'
            : 'relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-accent/10 via-surface to-surface p-6 sm:p-8'
        }
      >
        {!team && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-accent/10 blur-3xl"
          />
        )}
        <div className={team ? '' : 'relative max-w-2xl'}>
          {!team && (
            <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-surface/80 px-3 py-1 text-xs font-semibold text-accent">
              CƠ HỘI THAM GIA ĐỘI
            </span>
          )}
          <Heading
            className={
              team
                ? 'text-2xl font-bold'
                : 'text-3xl font-bold tracking-tight sm:text-4xl'
            }
          >
            {team ? 'Vị trí đang tuyển' : 'Tìm đội phù hợp với bạn'}
          </Heading>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            {owner
              ? 'Đăng và quản lý các vị trí tuyển dụng của đội.'
              : team
              ? 'Khám phá các vị trí đội đang tuyển và gửi hồ sơ phù hợp.'
              : 'Khám phá vị trí đang mở, kết nối với đội phát triển và tìm nơi bạn có thể tạo ra giá trị.'}
          </p>
          {!team && resource.data && (
            <p className="mt-4 text-sm font-medium text-ink">
              <span className="text-accent">{opportunityCount}</span>{' '}
              {'vị trí phù hợp'}
            </p>
          )}
        </div>
        {owner && team && resource.user && (
          <ComposerEntry
            user={resource.user}
            scope={`team:${team}:opening:new`}
            title="Đăng tin tuyển thành viên"
            submitLabel="Đăng vị trí tuyển dụng"
          >
            <OpeningForm
              team={team}
              user={resource.user}
              onSaved={async () => {
                setPage(0);
                await resource.reload();
              }}
            />
          </ComposerEntry>
        )}
      </header>
      {!team && (
        <div className="space-y-3">
          <form
            className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search);
              setPage(0);
            }}
          >
            <TextField
              label="Tìm kiếm cơ hội"
              aria-label="Tìm vị trí, kỹ năng hoặc đội"
              placeholder="Vị trí, kỹ năng hoặc tên đội…"
              maxLength={100}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button type="submit" className="min-h-[42px]">
              Tìm cơ hội
            </Button>
          </form>
          <details className="rounded-xl border border-line bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Bộ lọc nâng cao</summary>
            <div className="grid gap-3 border-t border-line p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid min-w-0 gap-1 sm:col-span-2">
              <span className="font-semibold text-accent">
                Kỹ năng dùng để so khớp
              </span>
              <input
                type="text"
                aria-label="Kỹ năng của bạn để so khớp"
                maxLength={1200}
                value={mySkills}
                onChange={(event) => {
                  setMySkills(event.target.value);
                  saveMatchingSkills(
                    event.target.value,
                    myHours,
                    resource.user,
                  );
                }}
                className="w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-muted">Giờ rảnh mỗi tuần</span>
              <input
                type="number"
                min={1}
                max={168}
                aria-label="Số giờ rảnh mỗi tuần"
                value={myHours || ''}
                placeholder="Chưa cập nhật"
                onChange={(event) => {
                  const val = Math.max(
                    0,
                    Math.min(168, Number(event.target.value) || 0),
                  );
                  setMyHours(val);
                  saveMatchingSkills(mySkills, val, resource.user);
                }}
                className="w-full rounded-xl border border-line bg-surface px-2 py-1.5 text-center text-xs font-semibold text-ink"
              />
            </label>
            <button
              type="button"
              aria-pressed={sortByMatch}
              onClick={() => {
                setSortByMatch((v) => !v);
                setPage(0);
              }}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                sortByMatch
                  ? 'border-accent bg-accent text-on-accent shadow-xs'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              {sortByMatch
                ? '✓ Đang ưu tiên phù hợp nhất'
                : 'Sắp theo độ phù hợp'}
            </button>
            <label className="grid gap-1">
              Hình thức
              <select
                aria-label="Lọc hình thức làm việc"
                className={inputClass}
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value);
                  setPage(0);
                }}
              >
                <option value="ALL">Tất cả</option>
                <option value="REMOTE">Từ xa</option>
                <option value="HYBRID">Kết hợp</option>
                <option value="ONSITE">Tại văn phòng</option>
              </select>
            </label>
            <label className="grid gap-1">
              Độ phù hợp tối thiểu
              <select
                aria-label="Độ phù hợp tối thiểu"
                className={inputClass}
                value={minScore}
                onChange={(event) => {
                  setMinScore(Number(event.target.value));
                  setPage(0);
                }}
              >
                <option value={0}>Không giới hạn</option>
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={100}>100%</option>
              </select>
            </label>
            </div>
          </details>
        </div>
      )}
      {!resource.data ? (
        <p
          role="status"
          className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted"
        >
          Đang tải tin tuyển dụng…
        </p>
      ) : (
        <>
          {!resource.data.items.length && (
            <div className={`rounded-2xl border border-dashed border-line bg-surface px-6 text-center ${team ? "py-6" : "py-12"}`}>
              <span
                aria-hidden="true"
                className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent/10 text-xl text-accent"
              >
                ⌕
              </span>
              <h2 className="text-lg font-semibold">
                {team ? 'Đội chưa có vị trí đang tuyển' : 'Chưa tìm thấy cơ hội phù hợp'}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                {owner
                  ? 'Đăng tin tuyển thành viên để nhận hồ sơ và tìm ứng viên phù hợp với vị trí.'
                  : team
                  ? 'Các vị trí sẽ xuất hiện tại đây khi đội mở tuyển.'
                  : query
                  ? 'Thử một từ khóa khác hoặc xóa nội dung tìm kiếm để xem thêm vị trí đang tuyển.'
                  : 'Các đội sẽ đăng vị trí mới tại đây. Hãy quay lại sau để khám phá cơ hội phù hợp.'}
              </p>
              {query && (
                <Button
                  kind="secondary"
                  className="mt-5"
                  onClick={() => {
                    setSearch('');
                    setQuery('');
                    setPage(0);
                  }}
                >
                  Xóa tìm kiếm
                </Button>
              )}
            </div>
          )}
          {resource.data.items.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {resource.data.items.map((opening) => (
                <OpeningCard
                  key={opening.id}
                  opening={opening}
                  owner={owner}
                  user={resource.user}
                  userSkills={mySkills}
                  userHours={myHours}
                  onChanged={resource.reload}
                  onJoined={onJoined}
                />
              ))}
            </div>
          )}
          <Pagination
            page={page}
            total={resource.data.total}
            size={12}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function OpeningForm({
  team,
  user,
  onSaved,
  opening,
}: {
  team: string;
  opening?: Opening;
  user: string;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useComposerField('title', opening?.title ?? '');
  const [description, setDescription] = useComposerField('description', opening?.description ?? '');
  const [skills, setSkills] = useComposerField('skills', opening?.skills ?? '');
  const [mode, setMode] = useComposerField('mode', opening?.work_mode ?? 'REMOTE');
  const [hours, setHours] = useComposerField('hours', String(opening?.weekly_hours ?? 20));
  const [slots, setSlots] = useComposerField('slots', String(opening?.slots ?? 1));
  const [closesOn, setClosesOn] = useComposerField('closesOn', opening?.closes_on ?? '');
  const [reference, setReference] = useComposerField('reference', opening?.reference_url ?? '');
  const [images, setImages] = useComposerField('images', [] as string[]);
  const [replaceImages, setReplaceImages] = useComposerField('replaceImages', false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    skills?: string;
    reference?: string;
  }>({});
  const composer = useComposerStatus(busy, error);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const errors: typeof fieldErrors = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      errors.title = 'Vui lòng điền vào trường này.';
    } else if (trimmedTitle.length < 3) {
      errors.title = 'Vị trí cần tuyển phải có ít nhất 3 ký tự.';
    }
    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      errors.description = 'Vui lòng điền vào trường này.';
    } else if (trimmedDesc.length < 20) {
      errors.description = 'Mô tả công việc cần tối thiểu 20 ký tự.';
    }
    if (!skills.trim()) {
      errors.skills = 'Vui lòng điền vào trường này.';
    }
    const linkError = profileLinkError(reference);
    if (linkError) errors.reference = linkError;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        title, description, skills, workMode: mode, weeklyHours: Number(hours),
        slots: Number(slots), closesOn, referenceUrl: reference.trim() || undefined,
        images: opening ? (replaceImages ? images : undefined) : (images.length ? images : undefined),
        requestId,
      };
      await communityRequest(
        opening ? basePath(opening) : `community/teams/${team}/openings`,
        user,
        opening ? { opening: payload, version: opening.version } : payload,
        opening ? 'PUT' : 'POST',
      );
      composer?.complete();
      await onSaved();
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
        <legend className="mb-3 font-semibold">
          Thông tin vị trí cần tuyển
        </legend>
        <TextField
          label="Vị trí cần tuyển"
          required
          maxLength={100}
          value={title}
          error={fieldErrors.title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (fieldErrors.title)
              setFieldErrors((prev) => ({ ...prev, title: undefined }));
          }}
        />
        <TextAreaField
          label="Công việc và cách hợp tác"
          rows={5}
          required
          maxLength={3000}
          value={description}
          error={fieldErrors.description}
          onChange={(event) => {
            setDescription(event.target.value);
            if (fieldErrors.description)
              setFieldErrors((prev) => ({ ...prev, description: undefined }));
          }}
        />
        <TextField
          label="Kỹ năng cần có"
          required
          maxLength={300}
          value={skills}
          error={fieldErrors.skills}
          onChange={(event) => {
            setSkills(event.target.value);
            if (fieldErrors.skills)
              setFieldErrors((prev) => ({ ...prev, skills: undefined }));
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Hình thức làm việc
            <select
              className={inputClass}
              value={mode}
              onChange={(event) => setMode(event.target.value)}
            >
              {Object.entries(modes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Số giờ dự kiến mỗi tuần"
            type="number"
            required
            min={1}
            max={80}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
          />
          <TextField
            label="Số thành viên cần tuyển"
            type="number"
            required
            min={1}
            max={20}
            value={slots}
            onChange={(event) => setSlots(event.target.value)}
          />
          <TextField
            label="Ngày hết hạn nhận hồ sơ"
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
            value={closesOn}
            onChange={(event) => setClosesOn(event.target.value)}
          />
        </div>
        <TextField label="Liên kết đính kèm" type="url" maxLength={2048} value={reference}
          error={fieldErrors.reference} onChange={event => {
            setReference(event.target.value);
            setFieldErrors(previous => ({ ...previous, reference: undefined }));
          }} placeholder="https://…" />
        {opening && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={replaceImages} onChange={event => setReplaceImages(event.target.checked)} />
            Thay ảnh đính kèm (để trống để xóa ảnh hiện tại)
          </label>
        )}
        {(!opening || replaceImages) && <PostImagePicker value={images} onChange={setImages} />}
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        {!composer && (
          <Button type="submit" loading={busy}>
            {opening ? 'Lưu thay đổi' : 'Đăng vị trí tuyển dụng'}
          </Button>
        )}
      </fieldset>
    </form>
  );
}

function OpeningCard({
  opening,
  owner,
  user,
  userSkills = '',
  userHours = 25,
  onChanged,
  onJoined,
}: {
  opening: Opening;
  owner: boolean;
  user?: string;
  userSkills?: string;
  userHours?: number;
  onChanged: () => Promise<void>;
  onJoined?: () => Promise<void>;
}) {
  const match = computeSkillMatch(
    opening.skills,
    userSkills,
    opening.weekly_hours,
    userHours,
  );
  const linkedOpening = communityQueryId('opening') === String(opening.id);
  const [detailsOpen, setDetailsOpen] = useState(linkedOpening);
  const [viewing, setViewing] = useState(linkedOpening && communityQueryId('application') !== null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const full = opening.filled_slots >= opening.slots;
  const expired = opening.closes_on < new Date().toISOString().slice(0, 10);
  const available = opening.status === 'OPEN' && !full && !expired;
  async function status(status: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await communityRequest(
        basePath(opening) + '/status',
        user,
        { status, version: opening.version },
        'PUT',
      );
      await onChanged();
      setMessage('Đã cập nhật trạng thái tin tuyển dụng.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="group flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold leading-snug tracking-tight">
            {opening.title}
          </h2>
          <a
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            href={'/teams/' + opening.team_id}
          >
            <span
              aria-hidden="true"
              className="flex size-6 items-center justify-center rounded-lg bg-accent/10 text-[10px]"
            >
              ✦
            </span>
            {opening.team_name}
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!owner && Boolean(opening.role_match) && <span className="rounded-full border border-accent/30 bg-tint px-2.5 py-1 text-xs font-semibold text-accent">Khớp vai trò</span>}
          {!owner && (
            <span
              aria-label={match.summaryLabel}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${
                match.score >= 70
                  ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : match.score >= 40
                    ? 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'border-line bg-panel text-muted'
              }`}
            >
              ✦ {match.summaryLabel}
            </span>
          )}
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${available ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-line bg-panel text-muted'}`}
          >
            {expired
              ? 'Đã hết hạn'
              : full
                ? 'Đã tuyển đủ'
                : statuses[opening.status]}
          </span>
        </div>
      </div>
      <p className="line-clamp-2 break-words text-sm leading-6 text-muted">
        {opening.description}
      </p>
      <div className="grid gap-2 border-y border-line py-3 text-xs text-muted sm:grid-cols-3">
        <span className="rounded-lg bg-panel/70 px-3 py-2">
          {modes[opening.work_mode]} · {opening.weekly_hours} giờ/tuần
        </span>
        <span className="rounded-lg bg-panel/70 px-3 py-2">
          Đã tuyển {opening.filled_slots}/{opening.slots} người
        </span>
        <span className="rounded-lg bg-panel/70 px-3 py-2">
          Hạn: {dateLabel(opening.closes_on)}
        </span>
      </div>
      <Button className="mt-auto self-start" kind="secondary" icon="arrow" aria-haspopup="dialog"
        onClick={() => setDetailsOpen(true)}>Xem chi tiết</Button>
      {detailsOpen && (
        <Modal open onClose={() => setDetailsOpen(false)} title={opening.title} maxWidth="xl" scrollBody>
          <div className="space-y-4">
            <p className="rounded-xl bg-panel px-3 py-2 text-xs font-medium text-muted">
              {modes[opening.work_mode]} · {opening.weekly_hours} giờ/tuần · Đã tuyển {opening.filled_slots}/{opening.slots} · Hạn {dateLabel(opening.closes_on)}
            </p>
            {owner && user && (opening.canEdit ? (
              <ComposerEntry user={user} scope={`opening:${opening.id}:edit:${opening.version}`}
                title="Chỉnh sửa tin tuyển dụng" submitLabel="Lưu thay đổi">
                <OpeningForm team={String(opening.team_id)} user={user} opening={opening} onSaved={onChanged} />
              </ComposerEntry>
            ) : opening.canEdit === false && opening.status !== 'CLOSED' && (
              <p className="text-sm text-muted">Tin đã nhận hồ sơ. Bạn có thể đăng tin mới nếu điều kiện tuyển dụng thay đổi.</p>
            ))}
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted">
              {opening.description}
            </p>
            <PostMedia kind="OPENING" id={opening.id} reference={opening.reference_url}
              imageCount={opening.image_count} privateUser={!available && owner ? user : undefined} />
            {opening.skills && (
              <div className="flex flex-wrap gap-2" aria-label="Kỹ năng cần có">
                {opening.skills
                  .split(/[,，]/)
                  .map((skill) => skill.trim())
                  .filter(Boolean)
                  .map((skill) => (
                    <span
                      key={skill}
                      className="rounded-lg bg-accent/8 px-2.5 py-1 text-xs font-medium text-accent"
                    >
                      {skill}
                    </span>
                  ))}
              </div>
            )}
            {message && (
              <p role="status" className="text-sm">
                {message}
              </p>
            )}
            {owner ? (
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button
                  kind="secondary"
                  onClick={() => setViewing((value) => !value)}
                >
                  {viewing ? 'Ẩn đơn ứng tuyển' : 'Xem đơn ứng tuyển'}
                </Button>
                {opening.status !== 'CLOSED' && (
                  <>
                    <Button
                      kind="ghost"
                      disabled={busy || expired}
                      onClick={() =>
                        void status(opening.status === 'OPEN' ? 'PAUSED' : 'OPEN')
                      }
                    >
                      {opening.status === 'OPEN'
                        ? 'Tạm dừng nhận hồ sơ'
                        : 'Mở lại nhận hồ sơ'}
                    </Button>
                    <Button
                      kind="ghost"
                      disabled={busy}
                      onClick={() => void status('CLOSED')}
                    >
                      Đóng tin tuyển dụng
                    </Button>
                  </>
                )}
              </div>
            ) : opening.myApplication ? (
              <p className="mt-auto rounded-xl bg-panel p-3 text-sm font-semibold">
                Đơn của bạn · {statuses[opening.myApplication.status]} ·{' '}
                <a className="text-accent" href="/teams?view=applications">
                  Xem đơn và phản hồi
                </a>
              </p>
            ) : opening.isMember ? (
              <p className="mt-auto rounded-xl bg-panel p-3 text-sm text-muted">
                Bạn đang là thành viên đội này.
              </p>
            ) : (
              available &&
              (user ? (
                <ComposerEntry
                  user={user}
                  scope={`opening:${opening.id}:application`}
                  title="Ứng tuyển vị trí này"
                  submitLabel="Gửi đơn ứng tuyển"
                >
                  <ApplicationForm
                    opening={opening}
                    user={user}
                    onSaved={onChanged}
                  />
                </ComposerEntry>
              ) : (
                <a
                  className="text-sm font-semibold text-accent"
                  href={
                    '/login?returnTo=' +
                    encodeURIComponent('/teams/' + opening.team_id)
                  }
                >
                  Đăng nhập để ứng tuyển
                </a>
              ))
            )}
            {viewing && owner && user && (
              <Applications
                opening={opening}
                user={user}
                onChanged={async () => {
                  await onChanged();
                  await onJoined?.();
                }}
              />
            )}
          </div>
        </Modal>
      )}
    </article>
  );
}

function ApplicationForm({
  opening,
  user,
  onSaved,
}: {
  opening: Opening;
  user: string;
  onSaved: () => Promise<void>;
}) {
  const [introduction, setIntroduction] = useComposerField('introduction', '');
  const [skills, setSkills] = useComposerField('skills', '');
  const [hours, setHours] = useComposerField(
    'hours',
    String(opening.weekly_hours),
  );
  const [consent, setConsent] = useComposerField('consent', false, false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    introduction?: string;
    skills?: string;
    hours?: string;
    consent?: string;
  }>({});
  const composer = useComposerStatus(busy, error);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const errors: typeof fieldErrors = {};
    const trimmedIntro = introduction.trim();
    if (!trimmedIntro) {
      errors.introduction = 'Vui lòng điền vào trường này.';
    } else if (trimmedIntro.length < 20) {
      errors.introduction =
        'Kinh nghiệm và lý do phù hợp cần tối thiểu 20 ký tự.';
    }
    if (!skills.trim()) {
      errors.skills = 'Vui lòng điền vào trường này.';
    }
    const numHours = Number(hours);
    if (!hours || isNaN(numHours) || numHours < 1 || numHours > 80) {
      errors.hours = 'Số giờ tham gia mỗi tuần từ 1 đến 80 giờ.';
    }
    if (!consent) {
      errors.consent = 'Vui lòng đồng ý chia sẻ thông tin trước khi ứng tuyển.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await communityRequest(
        basePath(opening) + '/applications',
        user,
        { introduction, skills, weeklyHours: Number(hours), consent },
        'POST',
      );
      composer?.complete();
      await onSaved();
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
      className={composer ? 'space-y-4' : 'space-y-4 border-t border-line pt-4'}
      onSubmit={(event) => void submit(event)}
    >
      <fieldset disabled={busy} className="space-y-4">
        <legend className="mb-3 font-semibold">
          Ứng tuyển vào {opening.title}
        </legend>
        <TextAreaField
          label="Kinh nghiệm và lý do phù hợp"
          rows={4}
          required
          maxLength={2000}
          value={introduction}
          error={fieldErrors.introduction}
          onChange={(event) => {
            setIntroduction(event.target.value);
            if (fieldErrors.introduction)
              setFieldErrors((prev) => ({ ...prev, introduction: undefined }));
          }}
        />
        <TextField
          label="Kỹ năng của bạn"
          required
          maxLength={300}
          value={skills}
          error={fieldErrors.skills}
          onChange={(event) => {
            setSkills(event.target.value);
            if (fieldErrors.skills)
              setFieldErrors((prev) => ({ ...prev, skills: undefined }));
          }}
        />
        <TextField
          label="Số giờ bạn có thể tham gia mỗi tuần"
          type="number"
          required
          min={1}
          max={80}
          value={hours}
          error={fieldErrors.hours}
          onChange={(event) => {
            setHours(event.target.value);
            if (fieldErrors.hours)
              setFieldErrors((prev) => ({ ...prev, hours: undefined }));
          }}
        />
        <label className="flex items-start gap-2 text-sm">
          <input
            className="mt-1"
            type="checkbox"
            required
            checked={consent}
            onChange={(event) => {
              setConsent(event.target.checked);
              if (fieldErrors.consent)
                setFieldErrors((prev) => ({ ...prev, consent: undefined }));
            }}
          />
          <span>
            Tôi đồng ý gửi thông tin trên cho chủ đội và tham gia đội nếu được
            nhận. Khi tham gia, tên tôi sẽ công khai trên hồ sơ đội.
          </span>
        </label>
        {fieldErrors.consent && (
          <p role="alert" className="text-xs text-danger">
            {fieldErrors.consent}
          </p>
        )}
        <p className="text-xs text-muted">
          Đơn chỉ bạn và chủ đội xem được. Mỗi vị trí nhận một đơn của bạn; bạn
          có thể rút trước khi đội duyệt.
        </p>
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        {!composer && (
          <Button type="submit" loading={busy}>
            Gửi đơn ứng tuyển
          </Button>
        )}
      </fieldset>
    </form>
  );
}

function Applications({
  opening,
  user,
  onChanged,
}: {
  opening: Opening;
  user: string;
  onChanged: () => Promise<void>;
}) {
  const [page, setPage] = useState(0);
  const resource = useCommunityResource<Page<Application>>(
    basePath(opening) +
      '/applications?page=' +
      page +
      (communityQueryId('application')
        ? '&applicationId=' + communityQueryId('application')
        : ''),
  );
  if (resource.error)
    return <ResourceError message={resource.error} reload={resource.reload} />;
  return (
    <section className="space-y-4 border-t border-line pt-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h4 className="font-semibold">Hồ sơ ứng tuyển · Chỉ chủ đội xem</h4>
        <Button kind="ghost" size="sm" onClick={() => void resource.reload()}>
          Tải lại hồ sơ
        </Button>
      </div>
      {!resource.data ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : (
        <>
          {!resource.data.items.length && (
            <p className="text-sm text-muted">Chưa có ứng viên gửi hồ sơ.</p>
          )}
          {resource.data.items.map((application) => (
            <ApplicationReview
              key={application.id}
              opening={opening}
              application={application}
              user={user}
              onChanged={async () => {
                await resource.reload();
                await onChanged();
              }}
            />
          ))}
          <Pagination
            page={page}
            total={resource.data.total}
            size={12}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function ApplicationReview({
  opening,
  application,
  user,
  onChanged,
}: {
  opening: Opening;
  application: Application;
  user: string;
  onChanged: () => Promise<void>;
}) {
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function review(accepted: boolean) {
    if (busy) return;
    if (!accepted && !feedback.trim()) {
      setMessage('Ghi lý do để ứng viên biết phần chưa phù hợp.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await communityRequest(
        basePath(opening) + `/applications/${application.id}/review`,
        user,
        { accepted, feedback, version: application.version },
        'PUT',
      );
      await onChanged();
      setMessage(
        accepted
          ? 'Đã nhận ứng viên vào đội.'
          : 'Đã gửi phản hồi cho ứng viên.',
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const canAccept =
    opening.status === 'OPEN' &&
    opening.filled_slots < opening.slots &&
    opening.closes_on >= new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h5 className="font-semibold">{application.display_name}</h5>
        <span className="text-xs text-accent">
          {statuses[application.status]}
        </span>
      </div>
      <p className="text-xs text-muted">
        Gửi ngày {dateLabel(application.created_at)} ·{' '}
        {application.weekly_hours} giờ/tuần
      </p>
      <p className="whitespace-pre-wrap break-words text-sm">
        {application.introduction}
      </p>
      <p className="break-words text-sm text-accent">{application.skills}</p>
      {application.status === 'PENDING' && (
        <>
          <label className="block text-sm">
            Phản hồi cho ứng viên
            <textarea
              className={inputClass}
              maxLength={1000}
              rows={3}
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
            />
          </label>
          <p className="text-xs text-muted">
            Nhận ứng viên sẽ thêm họ vào đội. Quyền truy cập dự án được quản lý
            riêng trong từng dự án.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !canAccept}
              onClick={() => void review(true)}
            >
              Nhận vào đội
            </Button>
            <Button
              kind="secondary"
              disabled={busy}
              onClick={() => void review(false)}
            >
              Chưa phù hợp
            </Button>
          </div>
        </>
      )}
      {application.feedback && (
        <p className="whitespace-pre-wrap break-words text-sm">
          Phản hồi · {application.feedback}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

export function MyApplications() {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const resource = useCommunityResource<Page<Application>>(
    'community/applications/mine?page=' +
      page +
      (communityQueryId('application')
        ? '&applicationId=' + communityQueryId('application')
        : ''),
  );
  async function withdraw(application: Application) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await communityRequest(
        basePath(application) + `/applications/${application.id}/withdraw`,
        resource.user,
        { version: application.version },
        'PUT',
      );
      await resource.reload();
      setMessage('Đã rút đơn ứng tuyển.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (!resource.user)
    return (
      <p className={panelClass}>Đăng nhập để xem đơn ứng tuyển của bạn.</p>
    );
  if (resource.error)
    return <ResourceError message={resource.error} reload={resource.reload} />;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        {communityQueryId('application') && (
          <a
            href="/teams?view=applications"
            className="text-sm font-semibold text-accent"
          >
            Xem tất cả đơn ứng tuyển →
          </a>
        )}
        <h2 className="text-2xl font-bold">Đơn ứng tuyển của tôi</h2>
        <Button kind="ghost" onClick={() => void resource.reload()}>
          Cập nhật kết quả
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      {!resource.data ? (
        <p role="status">Đang tải đơn ứng tuyển…</p>
      ) : (
        <>
          {!resource.data.items.length && (
            <p className={panelClass}>
              Bạn chưa gửi đơn ứng tuyển. Khám phá các vị trí để tìm đội phù
              hợp.
            </p>
          )}
          {resource.data.items.map((application) => (
            <article key={application.id} className={panelClass + ' space-y-3'}>
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="break-words text-lg font-semibold">
                  {application.title}
                </h3>
                <span className="text-sm text-accent">
                  {statuses[application.status]}
                </span>
              </div>
              <a
                className="text-sm text-accent"
                href={'/teams/' + application.team_id}
              >
                {application.team_name}
              </a>
              <p className="text-xs text-muted">
                Đã gửi {dateLabel(application.created_at)} ·{' '}
                {statuses[application.opening_status ?? '']} · Hạn nhận hồ sơ{' '}
                {dateLabel(application.closes_on ?? '')}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {application.introduction}
              </p>
              {application.feedback && (
                <p className="whitespace-pre-wrap break-words rounded-xl bg-panel p-3 text-sm">
                  Phản hồi từ đội · {application.feedback}
                </p>
              )}
              {application.status === 'ACCEPTED' && (
                <p className="text-sm text-success">
                  Bạn đã tham gia đội. Mở hồ sơ đội để xem danh sách thành viên.
                </p>
              )}
              {application.status === 'PENDING' && (
                <Button
                  kind="secondary"
                  disabled={busy}
                  onClick={() => void withdraw(application)}
                >
                  Rút đơn ứng tuyển
                </Button>
              )}
            </article>
          ))}
          <Pagination
            page={page}
            total={resource.data.total}
            size={12}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
