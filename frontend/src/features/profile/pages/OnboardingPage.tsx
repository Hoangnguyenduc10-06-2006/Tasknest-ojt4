import { useEffect, useRef, useState } from 'react';
import {
  authenticatedAccessToken,
  updateSessionUser,
  type SessionUser,
} from '../../auth';
import { requestJson } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { AccountPurposePicker } from '../../../shared/ui/AccountPurposePicker';
import { purposeLabels } from '../../../shared/account-purpose';
import {
  communityRequest,
  errorMessage,
  inputClass,
  panelClass,
  type MyTeams,
} from '../../community/community.api';
import { ProfileForm } from '../components/ProfileForm';
import {
  parseProfileTags,
  type ProfessionalProfile,
} from '../model/professional-profile';
import {
  draftFrom,
  suggestedPurpose,
  isClient,
  isDeveloper,
  professionalSetupInput,
  setupDestination,
  setupErrors,
  type SetupErrors,
  type OnboardingDraft,
  type OnboardingState,
} from '../model/onboarding';
import { developerRoles } from '../model/developer-roles';
import { safeReturnTo } from '../../../app/router/routes';
import { replaceTo } from '../../../app/router/location';

async function loadOnboarding(user: string) {
  const response = await requestJson<{ data: OnboardingState }>(
    '/api/identity/onboarding',
    { accessToken: await authenticatedAccessToken(user) },
  );
  updateSessionUser(response.data.user);
  return response.data;
}
export function OnboardingPage({ user }: { user: SessionUser }) {
  const [loaded, setLoaded] = useState<{
    state: OnboardingState;
    profile?: ProfessionalProfile;
    context?: MyTeams;
    revision: number;
  }>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.all([
      loadOnboarding(user.id),
      communityRequest<ProfessionalProfile>('community/profile', user.id).catch(
        () => undefined,
      ),
      communityRequest<MyTeams>('community/me', user.id).catch(() => undefined),
    ])
      .then(([state, profile, context]) => {
        if (active) {
          setLoaded({ state, profile, context, revision });
          setError('');
        }
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [user.id, revision]);
  if (error)
    return (
      <section className={panelClass} role="alert">
        <p>{error}</p>
        <Button onClick={() => setRevision((value) => value + 1)}>
          Tải lại thiết lập
        </Button>
      </section>
    );
  if (!loaded || loaded.revision !== revision)
    return <p role="status">Đang tải thiết lập tài khoản…</p>;
  return (
    <OnboardingWizard
      key={revision}
      user={user}
      initial={loaded.state}
      profile={loaded.profile}
      context={loaded.context}
      onReload={() => setRevision((value) => value + 1)}
    />
  );
}

function OnboardingWizard({
  user,
  initial,
  profile,
  context,
  onReload,
}: {
  user: SessionUser;
  initial: OnboardingState;
  profile?: ProfessionalProfile;
  context?: MyTeams;
  onReload: () => void;
}) {
  const [purpose, setPurpose] = useState(
    suggestedPurpose(initial.user.accountPurpose, context, profile),
  );
  const purposeSaved = ['CLIENT', 'DEVELOPER', 'BOTH'].includes(user.accountPurpose ?? '');
  const [step, setStep] = useState(
    (!purposeSaved || initial.user.onboardingStatus === 'COMPLETED')
      ? 0
      : (initial.user.onboardingStep ?? 0),
  );
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    draftFrom(initial, profile),
  );
  const formRef = useRef<HTMLDivElement>(null);
  const [fieldErrors, setFieldErrors] = useState<SetupErrors>({});
  const [validationAttempt, setValidationAttempt] = useState(0);
  useEffect(() => {
    if (validationAttempt)
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [validationAttempt]);
  function validate(snapshot: OnboardingDraft) {
    const errors = setupErrors(purpose, snapshot);
    setFieldErrors(errors);
    if (!Object.keys(errors).length) return true;
    setStep(errors.purpose ? 0 : 2);
    setValidationAttempt((value) => value + 1);
    setError('');
    return false;
  }
  const [skills, setSkills] = useState(draft.skills.join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const destination = safeReturnTo(
    setupDestination(
      new URLSearchParams(window.location.search).get('returnTo'),
    ),
  );
  function field<K extends keyof OnboardingDraft>(
    key: K,
    value: OnboardingDraft[K],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError('');
    if (key in fieldErrors) {
      const errors = setupErrors(purpose, {
        ...draft,
        [key]: value,
        skills: parseProfileTags(skills),
      });
      setFieldErrors((previous) => ({
        ...previous,
        [key]: errors[key as keyof SetupErrors],
      }));
    }
  }
  async function persist(
    target: number,
    status: 'IN_PROGRESS' | 'DEFERRED' | 'COMPLETED',
    version = user.version,
    draftOverride = draft,
  ) {
    if (busy || purpose === 'UNDECIDED') return;
    setBusy(true);
    setError('');
    const snapshot = { ...draftOverride, skills: parseProfileTags(skills) };
    try {
      if (version === undefined)
        throw Error('Không thể tải phiên bản tài khoản. Vui lòng tải lại.');
      if (status === 'COMPLETED') {
        if (!validate(snapshot)) return;
        if (isDeveloper(purpose)) {
          const current = await communityRequest<ProfessionalProfile>(
            'community/profile',
            user.id,
          );
          await communityRequest(
            'community/profile',
            user.id,
            professionalSetupInput(current, snapshot),
            'PUT',
          );
        }
      }
      const response = await requestJson<{ data: OnboardingState }>(
        '/api/identity/onboarding',
        {
          method: 'PUT',
          csrf: true,
          accessToken: await authenticatedAccessToken(user.id),
          body: { purpose, status, step: target, version, draft: snapshot },
        },
      );
      updateSessionUser(response.data.user);
      setDraft(snapshot);
      setStep(target);
      if (status === 'DEFERRED' || status === 'COMPLETED') {
        window.dispatchEvent(new Event('tasknest:sync'));
        replaceTo(
          status === 'COMPLETED' && destination === '/dashboard'
            ? purpose === 'CLIENT'
              ? '/customer-overview'
              : purpose === 'DEVELOPER'
                ? '/teams?view=recruiting'
                : '/dashboard'
            : destination,
        );
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  function nextDetails() {
    if (!validate({ ...draft, skills: parseProfileTags(skills) })) return;
    void persist(3, 'IN_PROGRESS');
  }
  const steps = ['Nhu cầu', 'Thông tin cá nhân', 'Giới thiệu', 'Hoàn tất'];
  return (
    <div ref={formRef} className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Bắt đầu cùng TaskNest
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            Thiết lập tài khoản của bạn
          </h1>
          <p className="mt-2 text-sm text-muted">
            Chọn nhu cầu sử dụng trước. Bạn có thể bổ sung thông tin hồ sơ sau.
          </p>
        </div>
        {purposeSaved && purpose !== 'UNDECIDED' && (
          <Button kind="ghost" disabled={busy} onClick={() => void persist(step, 'DEFERRED')}>
            Để sau
          </Button>
        )}
      </div>
      <ol
        aria-label="Tiến độ thiết lập"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? 'step' : undefined}
            className={
              'rounded-xl border p-3 text-xs ' +
              (step === index
                ? 'border-accent bg-tint font-semibold text-accent'
                : 'border-line text-muted')
            }
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft p-4 text-sm"
        >
          <p>{error}</p>
          <Button kind="ghost" size="sm" disabled={busy} onClick={onReload}>
            Tải lại dữ liệu
          </Button>
        </div>
      )}
      {step === 0 && (
        <section className={panelClass + ' space-y-5'}>
          {context?.teams.length || context?.activity?.isCustomer ? (
            <div className="space-y-2 rounded-xl bg-tint p-4 text-sm">
              <h2 className="font-semibold">Hoạt động hiện tại của bạn</h2>
              {!!context?.teams.length && (
                <p>
                  Bạn đang tham gia {context.teams.length} đội dev. Bạn vẫn có
                  thể thuê một đội khác cho dự án của mình.
                </p>
              )}
              {context?.activity?.isCustomer && (
                <p>
                  Bạn đã có hoạt động thuê đội hoặc đăng yêu cầu dự án. Bạn vẫn
                  có thể tham gia đội dev và nhận công việc.
                </p>
              )}
              <p className="text-xs text-muted">
                Vai trò được xác định theo từng đội và dự án, không phải cố định
                cho cả tài khoản.
              </p>
            </div>
          ) : null}
          <AccountPurposePicker
            value={purpose}
            disabled={busy}
            onChange={(value) => {
              setPurpose(value);
              setFieldErrors({});
            }}
          />
          {fieldErrors.purpose && (
            <p role="alert" className="text-xs text-danger">
              {fieldErrors.purpose}
            </p>
          )}
          <Button
            disabled={busy || purpose === 'UNDECIDED'}
            onClick={() => void persist(1, 'IN_PROGRESS')}
          >
            Lưu và tiếp tục
          </Button>
        </section>
      )}
      {step === 1 && (
        <>
          <p className="text-sm text-muted">
            Tên và ảnh đại diện được dùng chung trong TaskNest. Có thể bổ sung
            ảnh sau.
          </p>
          <ProfileForm
            showJobTitle={isDeveloper(purpose)}
            user={user}
            submitLabel="Lưu và tiếp tục"
            onSaved={(saved) =>
              void persist(2, 'IN_PROGRESS', saved.version, {
                ...draft,
                shareAvatar: saved.avatarPublic ?? false,
              })
            }
          />
        </>
      )}
      {step === 2 && (
        <section className={panelClass + ' space-y-5'}>
          <fieldset disabled={busy} className="space-y-5">
            <legend className="mb-4 text-lg font-semibold">
              {purposeLabels[purpose]} · Giới thiệu để hợp tác
            </legend>
            <TextField
              label="Khu vực làm việc"
              maxLength={100}
              value={draft.location}
              onChange={(event) => field('location', event.target.value)}
            />
            {isClient(purpose) && (
              <>
                <h2 className="font-semibold">Nhu cầu thuê đội</h2>
                <TextField
                  label="Cá nhân / Doanh nghiệp"
                  maxLength={100}
                  value={draft.company}
                  onChange={(event) => field('company', event.target.value)}
                  placeholder="Tên doanh nghiệp hoặc để trống nếu bạn là cá nhân"
                />
                <label className="block text-sm font-medium">
                  Bạn dự định thuê đội hỗ trợ điều gì?
                  <textarea
                    id="setup-goals"
                    aria-label="Bạn dự định thuê đội hỗ trợ điều gì?"
                    aria-invalid={!!fieldErrors.goals || undefined}
                    aria-describedby={
                      fieldErrors.goals ? 'setup-goals-error' : undefined
                    }
                    className={
                      inputClass +
                      (fieldErrors.goals
                        ? ' !border-danger focus:!ring-danger/20'
                        : '')
                    }
                    maxLength={1000}
                    rows={4}
                    value={draft.goals}
                    onChange={(event) => field('goals', event.target.value)}
                    placeholder="Có thể để trống nếu bạn chưa có dự án cần thuê đội ngay."
                  />
                  {fieldErrors.goals && (
                    <span
                      id="setup-goals-error"
                      role="alert"
                      className="mt-1.5 block text-xs text-danger"
                    >
                      {fieldErrors.goals}
                    </span>
                  )}
                </label>
              </>
            )}
            {isDeveloper(purpose) && (
              <>
                <h2 className="font-semibold">Hồ sơ nghề nghiệp</h2>
                <label className="block text-sm font-medium">
                  Vai trò chuyên môn
                  <select className={inputClass + ' mt-1'} value={
                    developerRoles.some(role => role.label === draft.headline) ? draft.headline : ''
                  } onChange={event => {
                    if (event.target.value) field('headline', event.target.value);
                  }}>
                    <option value="">Chọn vai trò hoặc nhập chuyên môn bên dưới</option>
                    {developerRoles.map(role => <option key={role.label}>{role.label}</option>)}
                  </select>
                </label>
                <p className="text-xs text-muted">TaskNest dùng vai trò và kỹ năng để xếp các vị trí tuyển dụng phù hợp lên trước.</p>
                <TextField
                  error={fieldErrors.headline}
                  label="Chuyên môn giới thiệu"
                  maxLength={150}
                  value={draft.headline}
                  onChange={(event) => field('headline', event.target.value)}
                  placeholder="Frontend Developer · React & TypeScript"
                />
                <label className="block text-sm font-medium">
                  Kinh nghiệm và định hướng
                  <textarea
                    id="setup-about"
                    aria-label="Kinh nghiệm và định hướng"
                    aria-invalid={!!fieldErrors.about || undefined}
                    aria-describedby={
                      fieldErrors.about ? 'setup-about-error' : undefined
                    }
                    className={
                      inputClass +
                      (fieldErrors.about
                        ? ' !border-danger focus:!ring-danger/20'
                        : '')
                    }
                    maxLength={2000}
                    rows={4}
                    value={draft.about}
                    onChange={(event) => field('about', event.target.value)}
                  />
                  {fieldErrors.about && (
                    <span
                      id="setup-about-error"
                      role="alert"
                      className="mt-1.5 block text-xs text-danger"
                    >
                      {fieldErrors.about}
                    </span>
                  )}
                </label>
                <TextField
                  error={fieldErrors.skills}
                  label="Kỹ năng"
                  maxLength={1000}
                  value={skills}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSkills(value);
                    if (fieldErrors.skills)
                      setFieldErrors((previous) => ({
                        ...previous,
                        skills: setupErrors(purpose, {
                          ...draft,
                          skills: parseProfileTags(value),
                        }).skills,
                      }));
                  }}
                  hint="Phân cách bằng dấu phẩy, tối đa 20 kỹ năng."
                />
              </>
            )}
            <p className="text-xs text-muted">
              Nội dung được lưu riêng tư khi chọn Lưu và tiếp tục hoặc Để sau.
              Bạn chọn quyền công khai ở bước tiếp theo.
            </p>
            <Button onClick={nextDetails}>Lưu và tiếp tục</Button>
          </fieldset>
        </section>
      )}
      {step === 3 && (
        <section className={panelClass + ' space-y-5'}>
          <h2 className="text-xl font-semibold">Xem lại trước khi hoàn tất</h2>
          <p className="font-semibold">
            {user.fullName} · {purposeLabels[purpose]}
          </p>
          {draft.location && (
            <p className="text-sm text-muted">{draft.location}</p>
          )}
          {isClient(purpose) && (
            <div className="space-y-2 rounded-xl bg-panel p-4">
              <h3 className="font-semibold">
                {draft.company || 'Thuê đội cho dự án của bạn'}
              </h3>
              <p className="whitespace-pre-wrap break-words text-sm">
                {draft.goals}
              </p>
            </div>
          )}
          {isDeveloper(purpose) && (
            <div className="space-y-3">
              <h3 className="font-semibold">{draft.headline}</h3>
              <p className="whitespace-pre-wrap break-words text-sm">
                {draft.about}
              </p>
              <p className="break-words text-sm text-accent">
                {parseProfileTags(skills).join(' · ')}
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.publishProfile}
                  disabled={busy}
                  onChange={(event) =>
                    field('publishProfile', event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  Công khai hồ sơ nghề nghiệp để khách hàng và đội phát triển
                  xem.
                </span>
              </label>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.shareAvatar}
              disabled={busy}
              onChange={(event) => field('shareAvatar', event.target.checked)}
              className="mt-1"
            />
            <span>
              Cho phép hiển thị ảnh đại diện tài khoản trên hồ sơ công khai.
            </span>
          </label>
          <p className="text-xs text-muted">
            Bạn có thể cập nhật nhu cầu, nội dung và quyền hiển thị trong Hồ sơ
            cá nhân bất cứ lúc nào.
          </p>
          <Button loading={busy} onClick={() => void persist(3, 'COMPLETED')}>
            Hoàn tất thiết lập
          </Button>
        </section>
      )}
      {step > 0 && (
        <Button
          kind="ghost"
          disabled={busy}
          onClick={() => void persist(step - 1, 'IN_PROGRESS')}
        >
          ← Quay lại bước trước
        </Button>
      )}
    </div>
  );
}
