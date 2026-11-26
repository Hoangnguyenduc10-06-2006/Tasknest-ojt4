import { CoverImage } from './TeamCover';
import { ProposalPlan } from './ProposalPlan';
import { planSections, readProposalPlan } from './proposal-plan';
import { Icon, type IconName } from '../../shared/ui/Icon';
import { PostImagePicker, PostMedia, RequestImageSlideshow } from './PostMedia';
import type { ProfessionalProfile } from '../profile/model/professional-profile';
import { DraftButton } from './DraftButton';
import { requestDraftStorageKey } from './draftStorage';
import { useComposerField, useComposerStatus } from './composer.state';
import { ComposerEntry } from './ComposerDialog';
import { ProposalDiscussion } from './ProposalDiscussion';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ComponentProps,
} from 'react';
import { Modal } from '../../shared/ui/Modal';
import { useSession } from '../auth';
import { UserAvatar } from '../profile/components/UserAvatar';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { TextAreaField } from '../../shared/ui/TextAreaField';
import { navigateTo, replaceTo } from '../../app/router/location';
import { ChatLink } from '../messaging/ChatLink';
import {
  communityRequest,
  communityQueryId,
  errorMessage,
  inputClass,
  panelClass,
  dateLabel,
  useCommunityResource,
  type MyTeams,
  type TeamProfile,
} from './community.api';
import {
  readRequestDraft,
  saveRequestDraft,
  clearRequestDraft,
} from './requestDraft';
import { Pagination } from './CommunityPagination';
import { computeSkillMatch, getSavedMatchingSkills } from './skill-matching';
import {
  budgetLabel,
  money,
  requestStatuses,
  proposalStatuses,
  type CustomerRequest,
  type Proposal,
  type MarketplacePageResult,
} from './marketplace.api';

export function MarketplacePage({ pathname }: { pathname: string }) {
  const id = pathname.match(/^\/requests\/([1-9]\d*)$/)?.[1];
  return id ? <RequestDetails id={id} /> : <RequestDirectory />;
}
function RequestDirectory() {
  const [view] = useState(
    new URLSearchParams(window.location.search).get('view') === 'mine'
      ? 'mine'
      : 'all',
  );
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).get('compose') === '1');
  function closeComposer() {
    setCreating(false);
    if (new URLSearchParams(window.location.search).has('compose')) replaceTo('/requests?view=mine');
  }
  const [draftNotice, setDraftNotice] = useState('');
  const resource = useCommunityResource<MarketplacePageResult<CustomerRequest>>(
    `community/${view === 'mine' ? 'my-requests' : 'requests'}?search=${encodeURIComponent(query)}&page=${page}`,
  );
  const profile = useCommunityResource<ProfessionalProfile>(resource.user && view === 'all' ? 'community/profile' : null);
  const myTeams = useCommunityResource<MyTeams>(resource.user && view === 'all' ? 'community/me' : null);
  const ownedTeams = myTeams.data?.teams.filter(team => team.owner_user_id === resource.user) ?? [];
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-tint via-panel to-surface px-5 py-6 shadow-panel sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full bg-accent/5 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-accent">Cơ hội hợp tác</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{view === 'mine' ? 'Yêu cầu đã đăng' : 'Tìm dự án phù hợp'}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">
              {view === 'mine' ? 'Đăng yêu cầu mới và theo dõi đề xuất của các đội.' : 'Xem yêu cầu đang mở và gửi đề xuất thực hiện.'}
            </p>
          </div>
        {resource.user ? (
          <DraftButton
            storageKey={requestDraftStorageKey(resource.user)}
            aria-haspopup="dialog"
            onClick={() => {
              setDraftNotice('');
              setCreating(true);
            }}
          >
            Đăng yêu cầu dự án
          </DraftButton>
        ) : (
          <a
            className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-on-accent"
            href="/login?returnTo=/requests"
          >
            Đăng nhập để đăng yêu cầu
          </a>
        )}
        </div>
      </section>
      {creating && resource.user && (
        <RequestComposer
          user={resource.user}
          onClose={closeComposer}
          onDraftSaved={() => {
            closeComposer();
            setDraftNotice(
              'Đã lưu bản nháp trên thiết bị này. Bấm Đăng yêu cầu dự án để tiếp tục soạn.',
            );
          }}
          onSaved={(id) => navigateTo('/requests/' + id)}
        />
      )}
      {draftNotice && (
        <p role="status" className="text-sm text-muted">
          {draftNotice}
        </p>
      )}
      {resource.user && (
        <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-panel p-1" role="group" aria-label="Lọc yêu cầu dự án">
          <Button
            kind={view === 'all' ? 'primary' : 'secondary'}
            onClick={() => {
              navigateTo('/requests');
              setPage(0);
            }}
          >
            Tìm dự án
          </Button>
          <Button
            kind={view === 'mine' ? 'primary' : 'secondary'}
            onClick={() => {
              navigateTo('/requests?view=mine');
              setPage(0);
            }}
          >
            Yêu cầu của tôi
          </Button>
        </div>
      )}
      <form
        className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-panel sm:flex-row sm:items-end sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search);
          setPage(0);
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="Tìm theo tên yêu cầu hoặc kỹ năng"
            maxLength={100}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ví dụ: website thương mại, React, ứng dụng đặt lịch…"
          />
        </div>
        <Button type="submit" icon="search" className="w-full sm:w-auto">Tìm dự án</Button>
      </form>
      {resource.error ? (
        <LoadError error={resource.error} reload={resource.reload} />
      ) : !resource.data ? (
        <p role="status">Đang tải yêu cầu dự án…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
            <p className="font-semibold">{view === 'mine' ? 'Yêu cầu của tôi' : 'Yêu cầu đang tìm đội'} <span className="ml-1 rounded-full bg-tint px-2 py-0.5 text-xs font-semibold text-accent">{resource.data.total}</span></p>
            <p className="text-xs text-muted">Thông tin cập nhật từ khách hàng</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {resource.data.items.map((request) => (
              <a
                href={'/requests/' + request.id}
                key={request.id}
                className={
                  panelClass + ' group flex min-w-0 flex-col gap-3 rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg'
                }
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-tint px-2.5 py-1 text-[11px] font-semibold text-accent">
                      {requestStatuses[request.status]}
                    </span>
                    {view === 'all' && (() => {
                      const saved = getSavedMatchingSkills(resource.user, profile.data);
                      const matches = ownedTeams.map(team => ({ name: team.name, match: computeSkillMatch(request.skills, team.skills) }));
                      const best = matches.filter(item => item.match.assessable).sort((left, right) => right.match.score - left.match.score)[0];
                      const match = best?.match ?? computeSkillMatch(request.skills, saved.skills);
                      if (!match.assessable) return null;
                      return (
                        <span title={match.matchedSkills.length ? 'Kỹ năng khớp: ' + match.matchedSkills.join(', ') : undefined} className="rounded-full border border-line bg-panel px-2.5 py-1 text-[11px] font-semibold text-muted">
                          {best ? best.name : 'Hồ sơ của bạn'} · {match.matchedSkills.length
                            ? 'Khớp ' + match.matchedSkills.length + '/' + (match.matchedSkills.length + match.missingSkills.length) + ' kỹ năng'
                            : 'Chưa có kỹ năng trùng khớp'}
                        </span>
                      );
                    })()}
                  </div>
                  <span className="text-xs text-muted">
                    {dateLabel(request.updated_at)}
                  </span>
                </div>
                <h2 className="break-words text-lg font-bold tracking-tight group-hover:text-accent">
                  {request.title}
                </h2>
                <p className="line-clamp-3 min-h-[4.5rem] break-words text-sm leading-6 text-muted">
                  {request.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(request.skills || 'Đội tư vấn công nghệ phù hợp').split(',').map((skill) => (
                    <span key={skill.trim()} className="rounded-full border border-line bg-panel px-2.5 py-1 text-xs text-muted">{skill.trim()}</span>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
                  <div>
                    <p className="text-sm font-bold">{budgetLabel(request)}</p>
                    <p className="mt-1 text-xs text-muted">Bàn giao dự kiến {dateLabel(request.desired_delivery)}</p>
                  </div>
                  <span className="text-xs text-muted">{request.proposal_count} đề xuất <span className="ml-1 font-semibold text-accent group-hover:underline">Xem chi tiết →</span></span>
                </div>
              </a>
            ))}
          </div>
          {!resource.data.items.length && (
            <div className={panelClass + ' rounded-2xl px-6 py-12 text-center'}>
              <h2 className="font-semibold">{view === 'mine' ? 'Bạn chưa đăng yêu cầu nào' : 'Chưa tìm thấy dự án phù hợp'}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{view === 'mine' ? 'Tạo yêu cầu đầu tiên để kết nối với đội phát triển phù hợp.' : 'Thử thay đổi từ khóa hoặc quay lại sau để xem các yêu cầu mới.'}</p>
              {view === 'mine' && resource.user && <Button className="mt-4" onClick={() => setCreating(true)}>Đăng yêu cầu dự án</Button>}
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
    </div>
  );
}
type ComposerState = { busy: boolean; dirty: boolean; error: string };
function RequestComposer({
  user,
  onClose,
  onSaved,
  onDraftSaved,
}: {
  user: string;
  onDraftSaved: () => void;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const session = useSession();
  const formId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ComposerState>({
    busy: false,
    dirty: false,
    error: '',
  });
  const [confirmClose, setConfirmClose] = useState(false);
  const [discardError, setDiscardError] = useState('');
  const name =
    session.status === 'authenticated' ? session.user.fullName : 'Bạn';
  useEffect(() => {
    if (!state.dirty && !state.busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty, state.busy]);
  useEffect(() => {
    if (confirmClose) confirmRef.current?.querySelector('button')?.focus();
  }, [confirmClose]);
  function close() {
    if (state.busy) return;
    if (state.dirty) setConfirmClose(true);
    else onClose();
  }
  return (
    <Modal
      open
      onClose={close}
      title="Đăng yêu cầu dự án"
      maxWidth="xl"
      scrollBody
      footer={
        !confirmClose && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              Các đội có thể xem và gửi đề xuất sau khi bạn đăng.
            </p>
            <Button type="submit" form={formId} loading={state.busy}>
              Đăng yêu cầu
            </Button>
          </div>
        )
      }
    >
      {confirmClose && (
        <div
          className="space-y-4"
          ref={confirmRef}
          role="group"
          aria-label="Lưu bản nháp hoặc hủy bỏ"
        >
          <h3 className="text-lg font-semibold">
            Lưu bản nháp trước khi thoát?
          </h3>
          <p className="text-sm text-muted">
            Bạn có thể lưu để tiếp tục sau trên thiết bị này hoặc hủy bỏ nội
            dung đang soạn.
          </p>
          {(state.error || discardError) && (
            <p role="alert" className="text-sm text-danger">
              {discardError || state.error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              kind="secondary"
              onClick={() => {
                setConfirmClose(false);
                setDiscardError('');
                requestAnimationFrame(() =>
                  contentRef.current
                    ?.querySelector<HTMLElement>('input, textarea, select')
                    ?.focus(),
                );
              }}
            >
              Tiếp tục chỉnh sửa
            </Button>
            <Button
              kind="danger"
              onClick={() => {
                try {
                  clearRequestDraft(user);
                  onClose();
                } catch {
                  setDiscardError('Chưa thể xóa bản nháp. Vui lòng thử lại.');
                }
              }}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              form={formId}
              name="intent"
              value="draft"
              formNoValidate
              loading={state.busy}
            >
              Lưu bản nháp
            </Button>
          </div>
        </div>
      )}
      <div ref={contentRef} hidden={confirmClose}>
        <div className="mb-5 flex items-center gap-3">
          <UserAvatar userId={user} name={name} />
          <div>
            <p className="font-semibold">{name}</p>
            <p className="text-xs text-muted">
              Chia sẻ nhu cầu và tìm đội phát triển phù hợp
            </p>
          </div>
        </div>
        <RequestForm
          user={user}
          onSaved={onSaved}
          onDraftSaved={onDraftSaved}
          composer
          formId={formId}
          onComposerState={setState}
        />
      </div>
    </Modal>
  );
}
function RequestForm({
  user,
  request,
  onSaved,
  composer = false,
  formId,
  onComposerState,
  onDraftSaved,
}: {
  onDraftSaved?: () => void;
  composer?: boolean;
  formId?: string;
  onComposerState?: (state: ComposerState) => void;
  user: string;
  request?: CustomerRequest;
  onSaved: (id: number) => void;
}) {
  const [draft] = useState(() => (composer ? readRequestDraft(user) : null));
  const [title, setTitle] = useState(request?.title ?? draft?.title ?? '');
  const [description, setDescription] = useState(
    request?.description ?? draft?.description ?? '',
  );
  const [skills, setSkills] = useState(request?.skills ?? draft?.skills ?? '');
  const [minimum, setMinimum] = useState(
    request?.budget_min == null
      ? (draft?.minimum ?? '')
      : String(request.budget_min),
  );
  const [maximum, setMaximum] = useState(
    request?.budget_max == null
      ? (draft?.maximum ?? '')
      : String(request.budget_max),
  );
  const [delivery, setDelivery] = useState(
    request?.desired_delivery ?? draft?.delivery ?? '',
  );
  const [reference, setReference] = useState(
    request?.reference_url ?? draft?.reference ?? '',
  );
  const [images, setImages] = useState(draft?.images ?? []);
  const initialImageCount = request?.image_count ?? 0;
  const [keepImages, setKeepImages] = useState(() => Array.from({ length: initialImageCount }, (_, index) => index + 1));
  const [publish, setPublish] = useState(request?.status === 'OPEN');
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    delivery?: string;
    minimum?: string;
    maximum?: string;
    reference?: string;
  }>({});
  const dirty = Boolean(
    title ||
      description ||
      skills ||
      minimum ||
      maximum ||
      delivery ||
      reference || images.length,
  );
  useLayoutEffect(() => {
    onComposerState?.({ busy, dirty, error });
  }, [busy, dirty, error, onComposerState]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (
      composer &&
      submitter instanceof HTMLButtonElement &&
      submitter.value === 'draft'
    ) {
      try {
        saveRequestDraft(user, {
          title,
          description,
          skills,
          minimum,
          maximum,
          delivery,
          reference,
          images,
        });
        onDraftSaved?.();
      } catch {
        setError(
          'Không thể lưu bản nháp trên thiết bị này. Hãy tiếp tục chỉnh sửa hoặc thử lại.',
        );
      }
      return;
    }

    const errors: typeof fieldErrors = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      errors.title = 'Vui lòng điền vào trường này.';
    } else if (trimmedTitle.length < 3) {
      errors.title = 'Tên yêu cầu phải có ít nhất 3 ký tự.';
    } else if (trimmedTitle.length > 100) {
      errors.title = 'Tên yêu cầu không được vượt quá 100 ký tự.';
    }

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      errors.description = 'Vui lòng điền vào trường này.';
    } else if (trimmedDescription.length < 30) {
      errors.description = 'Mục tiêu và phạm vi mong muốn cần tối thiểu 30 ký tự.';
    } else if (trimmedDescription.length > 5000) {
      errors.description = 'Mục tiêu và phạm vi không được vượt quá 5000 ký tự.';
    }

    if (!delivery) {
      errors.delivery = 'Vui lòng điền vào trường này.';
    }

    const minNum = minimum === '' ? null : Number(minimum);
    const maxNum = maximum === '' ? null : Number(maximum);
    if (minNum !== null && (isNaN(minNum) || minNum < 0)) {
      errors.minimum = 'Ngân sách tối thiểu không hợp lệ.';
    }
    if (maxNum !== null && (isNaN(maxNum) || maxNum < 0)) {
      errors.maximum = 'Ngân sách tối đa không hợp lệ.';
    }
    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      errors.maximum = 'Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu.';
    }

    if (reference.trim()) {
      try {
        const parsed = new URL(reference.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          errors.reference = 'Đường dẫn phải bắt đầu bằng http:// hoặc https://';
        }
      } catch {
        errors.reference = 'Liên kết tài liệu tham khảo không đúng định dạng URL.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const id = await communityRequest<number>(
        'community/requests' + (request ? '/' + request.id : ''),
        user,
        {
          title,
          description,
          skills,
          budgetMin: minimum === '' ? null : Number(minimum),
          budgetMax: maximum === '' ? null : Number(maximum),
          desiredDelivery: delivery,
          referenceUrl: reference.trim() || null,
          images: images.length ? images : undefined,
          keepImages: request && (images.length || keepImages.length !== initialImageCount) ? keepImages : undefined,
          publish: composer || publish,
          requestId,
          version: request?.version,
        },
        request ? 'PUT' : 'POST',
      );
      if (composer) {
        try {
          clearRequestDraft(user);
        } catch {
          /* Publishing succeeded even if local storage is unavailable. */
        }
      }
      onSaved(request?.id ?? id);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      id={formId}
      noValidate
      className="space-y-4"
      onSubmit={(event) => void submit(event)}
    >
      <fieldset disabled={busy} className="space-y-4">
        <legend className="sr-only">Thông tin yêu cầu dự án</legend>
        <TextField
          label="Tên yêu cầu"
          required
          maxLength={100}
          value={title}
          error={fieldErrors.title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (fieldErrors.title)
              setFieldErrors((prev) => ({ ...prev, title: undefined }));
          }}
          placeholder="Ví dụ: Website đặt lịch cho phòng khám"
        />
        <TextAreaField
          label="Mục tiêu và phạm vi mong muốn"
          required
          rows={6}
          maxLength={5000}
          value={description}
          error={fieldErrors.description}
          onChange={(event) => {
            setDescription(event.target.value);
            if (fieldErrors.description)
              setFieldErrors((prev) => ({ ...prev, description: undefined }));
          }}
          placeholder="Sản phẩm phục vụ ai? Những chức năng cần có và kết quả bạn mong nhận được là gì?"
        />
        <TextField
          label="Kỹ năng hoặc công nghệ mong muốn"
          maxLength={300}
          value={skills}
          onChange={(event) => setSkills(event.target.value)}
          placeholder="Có thể để trống để đội phát triển tư vấn"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Ngân sách tối thiểu (VND)"
            type="number"
            min={0}
            max={999999999999}
            step={1}
            value={minimum}
            error={fieldErrors.minimum}
            onChange={(event) => {
              setMinimum(event.target.value);
              if (fieldErrors.minimum)
                setFieldErrors((prev) => ({ ...prev, minimum: undefined }));
            }}
          />
          <TextField
            label="Ngân sách tối đa (VND)"
            type="number"
            min={minimum || 0}
            max={999999999999}
            step={1}
            value={maximum}
            error={fieldErrors.maximum}
            onChange={(event) => {
              setMaximum(event.target.value);
              if (fieldErrors.maximum)
                setFieldErrors((prev) => ({ ...prev, maximum: undefined }));
            }}
          />
        </div>
        <p className="text-xs text-muted">
          Có thể để trống ngân sách để trao đổi theo đề xuất của đội.
        </p>
        <TextField
          label="Ngày bàn giao mong muốn"
          type="date"
          required
          value={delivery}
          error={fieldErrors.delivery}
          onChange={(event) => {
            setDelivery(event.target.value);
            if (fieldErrors.delivery)
              setFieldErrors((prev) => ({ ...prev, delivery: undefined }));
          }}
        />
        <TextField
          label="Liên kết tài liệu tham khảo"
          type="url"
          maxLength={2048}
          value={reference}
          error={fieldErrors.reference}
          onChange={(event) => {
            setReference(event.target.value);
            if (fieldErrors.reference)
              setFieldErrors((prev) => ({ ...prev, reference: undefined }));
          }}
          placeholder="https://..."
        />
        <PostImagePicker value={images} onChange={setImages} existing={request ? {
          positions: keepImages, id: request.id,
          privateUser: request.status === 'DRAFT' ? user : undefined,
          remove: position => setKeepImages(previous => previous.filter(value => value !== position)),
        } : undefined} />
        {!composer && (!request || request.status === 'DRAFT') && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={publish}
              onChange={(event) => setPublish(event.target.checked)}
              className="mt-1"
            />
            Đăng công khai để các đội xem và gửi đề xuất.
          </label>
        )}
        <p className="text-xs leading-5 text-muted">
          Khi công khai, tên khách hàng, nội dung yêu cầu và liên kết tham khảo
          có thể được mọi người xem. Bản nháp chỉ bạn xem được.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {!composer && (
          <Button type="submit" loading={busy}>
            {request
              ? 'Lưu thay đổi'
              : publish
                ? 'Đăng yêu cầu'
                : 'Lưu bản nháp'}
          </Button>
        )}
      </fieldset>
    </form>
  );
}
function LoadError({
  error,
  reload,
}: {
  error: string;
  reload: () => unknown;
}) {
  return (
    <div className={panelClass} role="alert">
      <p className="mb-3 text-danger">{error}</p>
      <Button onClick={() => void reload()}>Thử lại</Button>
    </div>
  );
}

function RequestFact({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-tint text-accent"><Icon name={icon} size={17} /></span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-semibold">{value}</dd>
      </div>
    </div>
  );
}

function RequestDetails({ id }: { id: string }) {
  const resource = useCommunityResource<CustomerRequest>(
    'community/requests/' + id,
  );
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function status(value: string) {
    if (!resource.data) return;
    setBusy(true);
    setMessage('');
    try {
      await communityRequest(
        'community/requests/' + id + '/status',
        resource.user,
        { status: value, version: resource.data.version },
        'PUT',
      );
      await resource.reload();
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  if (resource.error)
    return <LoadError error={resource.error} reload={resource.reload} />;
  const request = resource.data;
  if (!request) return <p role="status">Đang tải chi tiết yêu cầu…</p>;
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <a href={request.isOwner ? '/requests?view=mine' : '/requests'} className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline">
        {request.isOwner ? '← Yêu cầu đã đăng' : '← Tìm dự án'}
      </a>
      <header className="overflow-hidden rounded-3xl border border-line bg-surface shadow-panel">
        {Boolean(request.image_count) && (
          <RequestImageSlideshow key={`${request.id}/${request.version}`} id={request.id} imageCount={request.image_count ?? 0}
            privateUser={request.status === 'DRAFT' ? resource.user : undefined} />
        )}
        <div className="relative bg-gradient-to-br from-tint via-surface to-surface px-5 py-6 sm:px-8 sm:py-7">
          <span className="inline-flex rounded-full bg-tint px-3 py-1 text-xs font-semibold text-accent">
            {requestStatuses[request.status]}
          </span>
          <h1 className="mt-3 max-w-4xl break-words text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
            {request.title}
          </h1>
          <div className="mt-4 flex min-w-0 items-center gap-2.5">
            <UserAvatar name={request.customer_name} userId={request.customer_user_id} publicProfile className="size-10 border-2 border-surface shadow-sm" />
            <p className="min-w-0 break-words text-sm text-muted">
              Khách hàng · <span className="font-semibold text-ink">{request.customer_name}</span>
            </p>
          </div>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,19rem)] lg:items-start">
        <aside className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-panel lg:col-start-2 lg:row-start-1">
          <h2 className="text-base font-semibold">Thông tin dự án</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <RequestFact label="Ngân sách dự kiến" value={budgetLabel(request)} icon="briefcase" />
            <RequestFact label="Thời hạn mong muốn" value={dateLabel(request.desired_delivery)} icon="calendar" />
          </dl>
          {request.skills && (
            <div className="border-t border-line pt-4">
              <h3 className="mb-2 text-xs font-semibold text-muted">Kỹ năng và công nghệ</h3>
              <ul className="flex flex-wrap gap-2">
                {[...new Set(request.skills.split(',').map(skill => skill.trim()).filter(Boolean))].map(skill => (
                  <li key={skill} className="max-w-full break-words rounded-lg bg-tint px-2.5 py-1 text-xs font-medium text-accent">{skill}</li>
                ))}
              </ul>
            </div>
          )}
          {request.status === 'AWARDED' && (
            <div className="rounded-xl bg-success-soft p-4 text-sm">
              <p>Đã chọn {request.selected_team_name} thực hiện dự án.</p>
              {request.canAccessProject && request.project_id && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 font-semibold text-accent">
                  <a href={'/projects/' + request.project_id}>Mở dự án làm việc →</a>
                  <ChatLink destination={{ kind: 'project', id: request.project_id }} className="!min-h-9 !border-0 !bg-transparent !p-0 !shadow-none">Trao đổi dự án</ChatLink>
                </div>
              )}
            </div>
          )}
          {request.isOwner && request.status !== 'AWARDED' && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button
                kind="secondary"
                onClick={() => setEditing(true)}
              >
                Chỉnh sửa yêu cầu
              </Button>
              {request.status !== 'OPEN' && (
                <Button loading={busy} onClick={() => void status('OPEN')}>
                  Mở nhận đề xuất
                </Button>
              )}
              {request.status === 'OPEN' && (
                <Button
                  kind="secondary"
                  disabled={busy}
                  onClick={() => void status('PAUSED')}
                >
                  Tạm dừng
                </Button>
              )}
              {request.status !== 'CLOSED' && request.status !== 'DRAFT' && (
                <Button
                  kind="ghost"
                  disabled={busy}
                  onClick={() => void status('CLOSED')}
                >
                  Đóng yêu cầu
                </Button>
              )}
            </div>
          )}
          {message && (
            <p role="alert" className="text-sm text-danger">
              {message}
            </p>
          )}
        </aside>
        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-panel sm:p-7">
            <h2 className="mb-4 text-lg font-semibold">Mô tả yêu cầu</h2>
            <p className="max-w-[76ch] whitespace-pre-wrap break-words text-sm leading-7 text-ink">
              {request.description}
            </p>
          </section>
          {request.reference_url && (
            <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-panel sm:p-7">
              <h2 className="text-lg font-semibold">Liên kết tham khảo</h2>
              <PostMedia kind="REQUEST" id={request.id} reference={request.reference_url} />
            </section>
          )}
        </div>
      </div>
      {request.isOwner && resource.user && request.status !== 'AWARDED' && (
        <Modal open={editing} onClose={() => setEditing(false)} title="Chỉnh sửa yêu cầu" maxWidth="xl" scrollBody>
          {editing && (
            <RequestForm
              key={request.version}
              user={resource.user}
              request={request}
              onSaved={() => {
                setEditing(false);
                void resource.reload();
              }}
            />
          )}
        </Modal>
      )}
      {resource.user ? (
        <RequestProposals
          request={request}
          user={resource.user}
          onChanged={resource.reload}
        />
      ) : (
        <p className={panelClass + ' text-sm'}>
          <a
            href={'/login?returnTo=/requests/' + id}
            className="font-semibold text-accent"
          >
            Đăng nhập
          </a>{' '}
          để gửi và theo dõi đề xuất của đội.
        </p>
      )}
    </div>
  );
}
function RequestProposals({
  request,
  user,
  onChanged,
}: {
  request: CustomerRequest;
  user: string;
  onChanged: () => Promise<void>;
}) {
  const [page, setPage] = useState(0);
  const proposals = useCommunityResource<MarketplacePageResult<Proposal>>(
    `community/requests/${request.id}/proposals?page=${page}${communityQueryId('proposal') ? '&proposalId=' + communityQueryId('proposal') : ''}`,
  );
  const reloadProposals = proposals.reload;
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reloadProposals();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [reloadProposals]);
  const mine = useCommunityResource<MyTeams>(
    !request.isOwner && request.status === 'OPEN' ? 'community/me' : null,
  );
  const [selectedTeam, setSelectedTeam] = useState('');
  const selectedProposals = useCommunityResource<
    MarketplacePageResult<Proposal>
  >(
    selectedTeam
      ? `community/requests/${request.id}/proposals?teamId=${selectedTeam}`
      : null,
  );
  const [editing, setEditing] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [confirmChoice, setConfirmChoice] = useState(false);
  const preview = proposals.data?.items.find(proposal => proposal.id === previewId);
  const teamProfile = useCommunityResource<TeamProfile>(preview ? 'community/teams/' + preview.team_id : null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ownedTeams =
    mine.data?.teams.filter((team) => team.owner_user_id === user) ?? [];
  const ownProposal = selectedProposals.data?.items[0];
  async function execute(proposal: Proposal, action: 'withdraw' | 'accept') {
    setBusy(true);
    setMessage('');
    try {
      const project = await communityRequest<number>(
        `community/requests/${request.id}/proposals/${proposal.id}/${action}`,
        user,
        { version: proposal.version },
        'PUT',
      );
      setPreviewId(null);
      await proposals.reload();
      await onChanged();
      if (action === 'accept') {
        window.dispatchEvent(new Event('tasknest:sync'));
        navigateTo('/projects/' + project + '?tab=overview');
      } else setMessage('Đã rút đề xuất.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      {communityQueryId('proposal') && <a href={'/requests/'+request.id} className="text-sm font-semibold text-accent">Xem tất cả đề xuất →</a>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {request.isOwner ? 'Đề xuất từ các đội' : 'Đề xuất của đội bạn'}
        </h2>
        <Button
          kind="ghost"
          size="sm"
          onClick={() => {
            void proposals.reload();
            void onChanged();
          }}
        >
          Tải dữ liệu mới
        </Button>
      </div>
      {message && !preview && (
        <p role="status" className="rounded-xl bg-panel p-3 text-sm">
          {message}
        </p>
      )}
      {proposals.error ? (
        <LoadError error={proposals.error} reload={proposals.reload} />
      ) : !proposals.data ? (
        <p role="status">Đang tải đề xuất…</p>
      ) : (
        <>
          {proposals.data.items.map((proposal) => (
            <article key={proposal.id} className={panelClass + ' space-y-3'}>
              <div className="flex flex-wrap justify-between gap-3">
                <h3 className="text-lg font-semibold">
                  <a
                    className="text-accent"
                    href={'/teams/' + proposal.team_id}
                  >
                    {proposal.team_name}
                  </a>
                </h3>
                <span className="text-sm">
                  {proposalStatuses[proposal.status]}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <strong>{money(proposal.amount)}</strong>
                <span>
                  {dateLabel(proposal.starts_on)} –{' '}
                  {dateLabel(proposal.ends_on)}
                </span>
                <span>{proposal.member_count} thành viên</span>
              </div>
              {request.budget_max != null &&
                Number(proposal.amount) > Number(request.budget_max) && (
                  <p className="text-sm text-warning">
                    Chi phí đề xuất cao hơn ngân sách tối đa đang công bố.
                  </p>
                )}
              {!request.isOwner && <ProposalPlan plan={proposal.plan} />}
              {proposal.request_version !== request.version &&
                request.status !== 'AWARDED' && (
                  <p className="text-sm text-warning">
                    Yêu cầu đã thay đổi. Đội cần gửi lại đề xuất theo nội dung
                    mới trước khi khách hàng chọn.
                  </p>
                )}
              {(request.isOwner || (request.status === 'OPEN' && proposal.status === 'SUBMITTED')) && (
                <div className="flex flex-wrap gap-2">
                  {request.isOwner ? (
                    <Button kind="secondary" icon="users" aria-haspopup="dialog" onClick={() => {
                      setMessage('');
                      setConfirmChoice(false);
                      setPreviewId(proposal.id);
                    }}>
                      Xem đội và đề xuất
                    </Button>
                  ) : (
                    proposal.team_owner === user && (
                      <>
                        <Button
                          kind="secondary"
                          disabled={busy}
                          onClick={() => {
                            setSelectedTeam(String(proposal.team_id));
                            setEditing(true);
                          }}
                        >
                          Chỉnh sửa đề xuất
                        </Button>
                        <Button
                          kind="ghost"
                          disabled={busy}
                          onClick={() => void execute(proposal, 'withdraw')}
                        >
                          Rút đề xuất
                        </Button>
                      </>
                    )
                  )}
                </div>
              )}
              {user && (
                <ProposalDiscussion
                  proposal={proposal}
                  user={user}
                  onChanged={proposals.reload}
                />
              )}
            </article>
          ))}
          {!proposals.data.items.length && (
            <p className={panelClass + ' text-sm text-muted'}>
              {request.isOwner
                ? 'Chưa có đội gửi đề xuất. Các đội sẽ thấy yêu cầu khi bạn mở nhận đề xuất.'
                : 'Bạn chưa gửi đề xuất cho yêu cầu này.'}
            </p>
          )}
          <Pagination
            page={page}
            total={proposals.data.total}
            size={20}
            onChange={setPage}
          />
        </>
      )}
      {preview && (
        <Modal open onClose={() => { if (!busy) setPreviewId(null); }} title={preview.team_name} maxWidth="xl" scrollBody>
          <div className="space-y-4">
            {teamProfile.error ? (
              <LoadError error={teamProfile.error} reload={teamProfile.reload} />
            ) : !teamProfile.data ? (
              <p role="status" className="text-sm text-muted">Đang tải hồ sơ đội…</p>
            ) : (
              <section className="overflow-hidden rounded-2xl border border-line bg-panel/60">
                <div className="relative h-28 bg-gradient-to-br from-tint to-panel">
                  <CoverImage src={'/api/work/community/teams/' + preview.team_id + '/cover'} />
                </div>
                <div className="space-y-3 p-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{teamProfile.data.description || 'Đội chưa thêm giới thiệu.'}</p>
                  <p className="text-sm font-semibold">{teamProfile.data.member_count} thành viên · {teamProfile.data.completed_projects} dự án đã nghiệm thu · {teamProfile.data.rating == null ? 'Chưa có đánh giá' : Number(teamProfile.data.rating).toFixed(1) + '/5 sao'}</p>
                  {teamProfile.data.skills && <p className="break-words text-sm text-muted">{teamProfile.data.skills}</p>}
                  {teamProfile.data.members.length > 0 && (
                    <p className="text-sm text-muted"><strong className="text-ink">Thành viên</strong> · {teamProfile.data.members.slice(0, 5).map(member => member.display_name).join(', ')}{teamProfile.data.members.length > 5 && '…'}</p>
                  )}
                  <a href={'/teams/' + preview.team_id} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-accent">Mở hồ sơ đầy đủ của đội ↗</a>
                </div>
              </section>
            )}
            <p className="text-sm font-semibold">{money(preview.amount)} · {dateLabel(preview.starts_on)} – {dateLabel(preview.ends_on)}</p>
            <ProposalPlan plan={preview.plan} />
            {message && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{message}</p>}
            {request.status === 'OPEN' && preview.status === 'SUBMITTED' && (
              preview.request_version !== request.version ? (
                <p className="text-sm text-warning">Chờ đội gửi lại đề xuất theo phiên bản mới của yêu cầu.</p>
              ) : confirmChoice ? (
                <div className="space-y-3 rounded-xl border border-accent/30 bg-tint p-4">
                  <p className="text-sm">Xác nhận chọn {preview.team_name} với chi phí {money(preview.amount)}. TaskNest sẽ tạo dự án và lưu đề xuất làm thỏa thuận hợp tác.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button loading={busy} onClick={() => void execute(preview, 'accept')}>Xác nhận và tạo dự án</Button>
                    <Button kind="secondary" disabled={busy} onClick={() => setConfirmChoice(false)}>Quay lại</Button>
                  </div>
                </div>
              ) : teamProfile.data && <Button onClick={() => setConfirmChoice(true)}>Chọn đội này</Button>
            )}
          </div>
        </Modal>
      )}
      {!request.isOwner && request.status === 'OPEN' && (
        <>
          {mine.error && <LoadError error={mine.error} reload={mine.reload} />}
          {ownedTeams.length > 0 ? (
            <div className={panelClass + ' space-y-4'}>
              <h3 className="text-lg font-semibold">Gửi đề xuất thực hiện</h3>
              <label className="block text-sm">
                Đội bạn đại diện
                <select
                  className={inputClass}
                  value={selectedTeam}
                  onChange={(event) => {
                    setSelectedTeam(event.target.value);
                    setEditing(true);
                  }}
                >
                  <option value="">Chọn đội bạn làm chủ</option>
                  {ownedTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTeam &&
                editing &&
                (selectedProposals.error ? (
                  <LoadError
                    error={selectedProposals.error}
                    reload={selectedProposals.reload}
                  />
                ) : !selectedProposals.data ? (
                  <p role="status">Đang tải đề xuất của đội…</p>
                ) : (
                  <ProposalForm
                    key={
                      selectedTeam +
                      '/' +
                      (ownProposal?.version ?? 'new') +
                      '/' +
                      request.version
                    }
                    request={request}
                    team={Number(selectedTeam)}
                    user={user}
                    proposal={ownProposal}
                    onSaved={async () => {
                      setEditing(false);
                      await proposals.reload();
                      await selectedProposals.reload();
                    }}
                  />
                ))}
            </div>
          ) : (
            mine.data && (
              <p className={panelClass + ' text-sm'}>
                Bạn cần đại diện một đội để gửi đề xuất.{' '}
                <a
                  href="/team-management"
                  className="font-semibold text-accent"
                >
                  Tạo hoặc quản lý đội →
                </a>
              </p>
            )
          )}
        </>
      )}
    </section>
  );
}
function ProposalForm(props: ComponentProps<typeof ProposalFormFields>) {
  return (
    <ComposerEntry
      user={props.user}
      scope={`request:${props.request.id}:team:${props.team}:proposal:${props.proposal?.version ?? 'new'}:request-version:${props.request.version}`}
      title={
        props.proposal ? 'Chỉnh sửa đề xuất thực hiện' : 'Gửi đề xuất thực hiện'
      }
      submitLabel={props.proposal ? 'Gửi lại đề xuất' : 'Gửi đề xuất'}
    >
      <ProposalFormFields {...props} />
    </ComposerEntry>
  );
}
function ProposalFormFields({
  request,
  team,
  user,
  proposal,
  onSaved,
}: {
  request: CustomerRequest;
  team: number;
  user: string;
  proposal?: Proposal;
  onSaved: () => Promise<void>;
}) {
  const [legacyPlan] = useComposerField('plan', proposal?.plan ?? '');
  const initial = readProposalPlan(legacyPlan);
  const [scope, setScope] = useComposerField('scope', initial.scope);
  const [approach, setApproach] = useComposerField('approach', initial.approach);
  const [milestones, setMilestones] = useComposerField('milestones', initial.milestones);
  const sections = { scope, approach, milestones };
  const setters = { scope: setScope, approach: setApproach, milestones: setMilestones };
  const [amount, setAmount] = useComposerField(
    'amount',
    proposal?.amount == null ? '' : String(proposal.amount),
  );
  const [start, setStart] = useComposerField(
    'start',
    proposal?.starts_on ?? '',
  );
  const [end, setEnd] = useComposerField(
    'end',
    proposal?.ends_on ?? request.desired_delivery,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    amount?: string;
    start?: string;
    end?: string;
    plan?: string;
    scope?: string;
    approach?: string;
    milestones?: string;
  }>({});
  const composer = useComposerStatus(busy, error);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const errors: typeof fieldErrors = {};
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt < 1) {
      errors.amount = 'Vui lòng nhập chi phí đề xuất hợp lệ (tối thiểu 1 VND).';
    }
    if (!start) {
      errors.start = 'Vui lòng chọn ngày bắt đầu đề xuất.';
    }
    if (!end) {
      errors.end = 'Vui lòng chọn ngày bàn giao đề xuất.';
    } else if (start && end < start) {
      errors.end = 'Ngày bàn giao không được trước ngày bắt đầu.';
    }
    for (const { key } of planSections) {
      if (!sections[key].trim()) errors[key] = 'Vui lòng điền nội dung cho phần này.';
    }
    const plan = planSections.map(({ key, title }) => '## ' + title + '\n' + sections[key].trim()).join('\n\n');
    if (plan.length > 4000) errors.plan = 'Tổng nội dung đề xuất không được vượt quá 4000 ký tự.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await communityRequest(
        `community/requests/${request.id}/proposals`,
        user,
        {
          teamId: team,
          requestVersion: request.version,
          plan,
          amount: Number(amount),
          startsOn: start,
          endsOn: end,
          version: proposal?.version,
        },
        'PUT',
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
      onSubmit={(event) => void save(event)}
    >
      <fieldset disabled={busy} className="space-y-4">
        <legend className="sr-only">Nội dung đề xuất</legend>
        <TextField
          label="Chi phí đề xuất (VND)"
          type="number"
          required
          min={1}
          step={1}
          max={999999999999}
          value={amount}
          error={fieldErrors.amount}
          onChange={(event) => {
            setAmount(event.target.value);
            if (fieldErrors.amount)
              setFieldErrors((prev) => ({ ...prev, amount: undefined }));
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Ngày bắt đầu đề xuất"
            type="date"
            required
            value={start}
            error={fieldErrors.start}
            onChange={(event) => {
              setStart(event.target.value);
              if (fieldErrors.start)
                setFieldErrors((prev) => ({ ...prev, start: undefined }));
            }}
          />
          <TextField
            label="Ngày bàn giao đề xuất"
            type="date"
            required
            min={start}
            value={end}
            error={fieldErrors.end}
            onChange={(event) => {
              setEnd(event.target.value);
              if (fieldErrors.end)
                setFieldErrors((prev) => ({ ...prev, end: undefined }));
            }}
          />
        </div>
        {planSections.map(({ key, title, hint }) => (
          <div key={key} className="rounded-xl border border-line bg-panel/40 p-3">
            <TextAreaField label={title} rows={3} required maxLength={4000}
              value={sections[key]} error={fieldErrors[key]} placeholder={hint}
              onChange={event => {
                setters[key](event.target.value);
                setFieldErrors(previous => ({ ...previous, [key]: undefined, plan: undefined }));
              }} />
          </div>
        ))}
        {fieldErrors.plan && <p role="alert" className="text-sm text-danger">{fieldErrors.plan}</p>}
        <p className="text-xs text-muted">
          Đề xuất chỉ được khách hàng và chủ đội xem. Bạn có thể cập nhật hoặc
          rút trước khi khách hàng chọn đội.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {!composer && (
          <Button type="submit" loading={busy}>
            {proposal ? 'Gửi lại đề xuất' : 'Gửi đề xuất'}
          </Button>
        )}
      </fieldset>
    </form>
  );
}
