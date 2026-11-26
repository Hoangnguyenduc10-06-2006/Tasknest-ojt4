import { useRef, useState, type FormEvent } from 'react';
import type { SessionUser } from '../../auth';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import {
  communityRequest,
  errorMessage,
  inputClass,
  panelClass,
  type useCommunityResource,
} from '../../community/community.api';
import {
  availabilityLabels,
  collaborationLabels,
  parseProfileTags,
  profileLinkError,
  type ProfessionalProfile,
  type PortfolioItem,
} from '../model/professional-profile';

export function ProfessionalProfileSection({
  user,
  resource,
}: {
  user: SessionUser;
  resource: ReturnType<typeof useCommunityResource<ProfessionalProfile>>;
}) {
  const [message, setMessage] = useState('');
  if (resource.error)
    return (
      <section role="alert" className={panelClass}>
        <p className="mb-3 text-danger">{resource.error}</p>
        <Button onClick={() => void resource.reload()}>Thử lại</Button>
      </section>
    );
  if (!resource.data)
    return (
      <p role="status" className={panelClass}>
        Đang tải hồ sơ nghề nghiệp…
      </p>
    );
  const profile = resource.data;
  return (
    <div className="space-y-5">
      <section className={panelClass + ' space-y-4'}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Hồ sơ nghề nghiệp</h2>
            <p className="mt-1 text-sm text-muted">
              {profile.configured
                ? profile.is_public ? 'Đang công khai' : 'Đang riêng tư'
                : 'Chưa thiết lập hồ sơ nghề nghiệp'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.is_public && (
              <a
                href={profile.publicUrl}
                className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-accent"
              >
                Xem hồ sơ công khai ↗
              </a>
            )}
          </div>
        </div>
        {profile.configured && (
          <>
            <div className="grid grid-cols-3 gap-3 border-t border-line pt-4">
              {[
                [profile.completedProjects, 'Dự án đã đóng góp'],
                [profile.recognitionCount, 'Ghi nhận khách hàng'],
                [profile.likes, 'Lượt thích hồ sơ'],
              ].map(([count, label]) => (
                <div key={String(label)}>
                  <p className="text-xl font-bold">{count}</p>
                  <p className="mt-1 text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">
              Dự án và ghi nhận được tổng hợp từ các lần khách hàng đã nghiệm
              thu trên TaskNest.
            </p>
          </>
        )}
      </section>
      {message && (
        <p role="status" className="rounded-xl bg-tint p-3 text-sm">
          {message}
        </p>
      )}
      {!profile.configured ? (
        <section className={panelClass + ' space-y-4'}>
          <h2 className="text-xl font-semibold">
            Bạn chưa thiết lập hồ sơ nghề nghiệp
          </h2>
          <p className="text-sm text-muted">
            Giới thiệu chuyên môn và nhu cầu hợp tác để đội phát triển hoặc
            khách hàng hiểu bạn hơn.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
              href="/setup?returnTo=%2Fprofile"
            >
              Thiết lập hồ sơ nghề nghiệp
            </a>
            <a className="px-4 py-2 text-sm text-muted" href="/dashboard">
              Để sau
            </a>
          </div>
        </section>
      ) : (
        <ProfessionalProfileForm
          key={profile.version ?? 'new'}
          user={user}
          profile={profile}
          onReload={resource.reload}
          onSaved={async () => {
            await resource.reload();
            setMessage('Đã lưu hồ sơ nghề nghiệp.');
          }}
        />
      )}
    </div>
  );
}

function ProfessionalProfileForm({
  user,
  profile,
  onSaved,
  onReload,
}: {
  user: SessionUser;
  profile: ProfessionalProfile;
  onSaved: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [headline, setHeadline] = useState(
    profile.headline ?? user.jobTitle ?? '',
  );
  const [about, setAbout] = useState(profile.about ?? user.bio ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [years, setYears] = useState(
    profile.experience_years == null ? '' : String(profile.experience_years),
  );
  const [skills, setSkills] = useState(profile.skills?.join(', ') ?? '');
  const [roles, setRoles] = useState(profile.desired_roles?.join(', ') ?? '');
  const [availability, setAvailability] = useState(
    profile.availability ?? 'BUSY',
  );
  const [hours, setHours] = useState(
    profile.weekly_hours == null ? '' : String(profile.weekly_hours),
  );
  const [modes, setModes] = useState<string[]>(
    profile.collaboration_modes ?? [],
  );
  const [github, setGithub] = useState(profile.github_url ?? '');
  const [linkedin, setLinkedin] = useState(profile.linkedin_url ?? '');
  const [website, setWebsite] = useState(profile.website_url ?? '');
  const [contactEmail, setContactEmail] = useState(profile.contact_email ?? '');
  const [social, setSocial] = useState(profile.social_url ?? '');
  const [portfolio, setPortfolio] = useState<
    (PortfolioItem & { key: string })[]
  >(() =>
    (profile.portfolio_items ?? []).map((item) => ({
      ...item,
      key: crypto.randomUUID(),
    })),
  );
  const [newProductKey, setNewProductKey] = useState<string>();
  const [isPublic, setIsPublic] = useState(profile.is_public ?? false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  function updatePortfolio(
    key: string,
    field: keyof PortfolioItem,
    value: string,
  ) {
    setPortfolio((items) =>
      items.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    setError('');
    const skillTags = parseProfileTags(skills),
      roleTags = parseProfileTags(roles);
    if (skillTags.length > 20 || skillTags.some((skill) => skill.length > 40)) {
      setError('Tối đa 20 kỹ năng, mỗi kỹ năng tối đa 40 ký tự.');
      return;
    }
    if (roleTags.length > 8 || roleTags.some((role) => role.length > 60)) {
      setError('Tối đa 8 vị trí mong muốn, mỗi vị trí tối đa 60 ký tự.');
      return;
    }
    if (isPublic && (!headline.trim() || !about.trim() || !skillTags.length)) {
      setError(
        'Điền chuyên môn, giới thiệu và ít nhất một kỹ năng trước khi công khai.',
      );
      return;
    }
    for (const link of [
      github,
      linkedin,
      website,
      social,
      ...portfolio.map((item) => item.url ?? ''),
    ]) {
      const linkError = profileLinkError(link);
      if (linkError) {
        setError(linkError);
        return;
      }
    }
    inFlight.current = true;
    setSaving(true);
    try {
      await communityRequest<ProfessionalProfile>(
        'community/profile',
        user.id,
        {
          headline: headline.trim(),
          about: about.trim(),
          location: location.trim(),
          experienceYears: years === '' ? null : Number(years),
          skills: skillTags,
          desiredRoles: roleTags,
          collaborationModes: modes,
          availability,
          weeklyHours: hours === '' ? null : Number(hours),
          githubUrl: github.trim() || null,
          linkedinUrl: linkedin.trim() || null,
          websiteUrl: website.trim() || null,
          contactEmail: contactEmail.trim(),
          socialUrl: social.trim(),
          portfolioItems: portfolio.map(
            ({ title, role, description, url }) => ({
              title: title.trim(),
              role: role.trim(),
              description: description.trim(),
              url: url?.trim() || null,
            }),
          ),
          isPublic,
          version: profile.version,
        },
        'PUT',
      );
      await onSaved();
      setNewProductKey(undefined);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  return (
    <form onSubmit={(event) => void save(event)} className="space-y-5">
      <fieldset disabled={saving} className={panelClass + ' space-y-4'}>
        <legend className="sr-only">Giới thiệu nghề nghiệp</legend>
        <h2 className="text-lg font-semibold">Chuyên môn & kinh nghiệm</h2>
        <TextField
          label="Chuyên môn giới thiệu"
          name="professionalHeadline"
          maxLength={150}
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          placeholder="Ví dụ: Full-stack Developer · React & Java"
        />
        <label className="block text-sm font-medium">
          Kinh nghiệm và định hướng
          <textarea
            maxLength={2000}
            rows={5}
            value={about}
            onChange={(event) => setAbout(event.target.value)}
            className={inputClass}
            placeholder="Bạn có thể giúp đội hoặc khách hàng giải quyết những công việc nào? Chia sẻ kinh nghiệm và định hướng của bạn."
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Khu vực làm việc"
            name="professionalLocation"
            maxLength={100}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Ví dụ: Hà Nội · Làm việc từ xa"
          />
          <TextField
            label="Số năm kinh nghiệm"
            name="experienceYears"
            type="number"
            min={0}
            max={50}
            step={1}
            value={years}
            onChange={(event) => setYears(event.target.value)}
            placeholder="Chưa có kinh nghiệm có thể nhập 0"
          />
        </div>
        <TextField
          label="Kỹ năng"
          name="professionalSkills"
          value={skills}
          onChange={(event) => setSkills(event.target.value)}
          maxLength={1000}
          placeholder="React, Java, MySQL, Figma"
          hint="Phân cách bằng dấu phẩy, tối đa 20 kỹ năng."
        />
        {parseProfileTags(skills).length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Kỹ năng đã nhập">
            {parseProfileTags(skills).map((skill) => (
              <span
                key={skill}
                className="max-w-full break-words rounded-lg bg-tint px-3 py-1 text-xs text-accent"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </fieldset>
      <fieldset disabled={saving} className={panelClass + ' space-y-4'}>
        <legend className="sr-only">Định hướng hợp tác</legend>
        <h2 className="text-lg font-semibold">Cơ hội bạn đang tìm</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Trạng thái hợp tác
            <select
              value={availability}
              onChange={(event) => setAvailability(event.target.value)}
              className={inputClass}
            >
              {Object.entries(availabilityLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="Thời gian có thể tham gia mỗi tuần"
            name="weeklyHours"
            type="number"
            min={1}
            max={80}
            step={1}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            hint="Số giờ dự kiến, có thể để trống."
          />
        </div>
        <TextField
          label="Vị trí mong muốn"
          name="desiredRoles"
          value={roles}
          onChange={(event) => setRoles(event.target.value)}
          maxLength={500}
          placeholder="Frontend Developer, UI/UX Designer"
          hint="Phân cách bằng dấu phẩy, tối đa 8 vị trí."
        />
        <div>
          <p className="mb-2 text-sm font-medium">Hình thức hợp tác</p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(collaborationLabels).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={modes.includes(key)}
                  onChange={(event) =>
                    setModes((current) =>
                      event.target.checked
                        ? [...current, key]
                        : current.filter((mode) => mode !== key),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      <fieldset disabled={saving} className={panelClass + ' space-y-4'}>
        <legend className="sr-only">Liên kết giới thiệu</legend>
        <h2 className="text-lg font-semibold">Liên kết chuyên môn</h2>
        <TextField
          label="GitHub"
          name="githubUrl"
          type="url"
          maxLength={2048}
          value={github}
          onChange={(event) => setGithub(event.target.value)}
          placeholder="https://github.com/..."
        />
        <TextField
          label="LinkedIn"
          name="linkedinUrl"
          type="url"
          maxLength={2048}
          value={linkedin}
          onChange={(event) => setLinkedin(event.target.value)}
          placeholder="https://www.linkedin.com/in/..."
        />
        <TextField
          label="Website cá nhân"
          name="websiteUrl"
          type="url"
          maxLength={2048}
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          placeholder="https://..."
        />
        <TextField label="Email liên hệ" type="email" value={contactEmail} maxLength={254}
          hint="Chỉ hiện khi bạn công khai hồ sơ. Có thể dùng email khác với email đăng nhập."
          onChange={event => setContactEmail(event.target.value)} />
        <TextField label="Liên kết khác" type="url" value={social} maxLength={2048}
          placeholder="https://…" onChange={event => setSocial(event.target.value)} />
      </fieldset>
      <fieldset disabled={saving} className={panelClass + ' space-y-4'}>
        <legend className="sr-only">Portfolio sản phẩm</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Sản phẩm tiêu biểu</h2>
          <Button
            kind="secondary"
            size="sm"
            disabled={portfolio.length >= 6 || Boolean(newProductKey)}
            onClick={() => {
              const key = crypto.randomUUID();
              setNewProductKey(key);
              setPortfolio(items => [...items, { key, title: '', role: '', description: '', url: '' }]);
            }}
          >
            Thêm sản phẩm
          </Button>
        </div>
        <p className="text-sm text-muted">
          Giới thiệu tối đa 6 sản phẩm bạn được phép chia sẻ. Nêu rõ vai trò và
          phần việc bạn đã thực hiện.
        </p>
        {portfolio.map((item, index) => (
          <div
            key={item.key}
            className="space-y-3 rounded-xl border border-line p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Sản phẩm {index + 1}</h3>
              <Button
                kind="ghost"
                size="sm"
                onClick={() => {
                  setPortfolio(items => items.filter(value => value.key !== item.key));
                  if (item.key === newProductKey) setNewProductKey(undefined);
                }}
                aria-label={(item.key === newProductKey ? 'Hủy thêm sản phẩm ' : 'Xóa sản phẩm ') + (index + 1)}
              >
                {item.key === newProductKey ? 'Hủy' : 'Xóa'}
              </Button>
            </div>
            <TextField
              label={'Tên sản phẩm ' + (index + 1)}
              required
              maxLength={120}
              value={item.title}
              onChange={(event) =>
                updatePortfolio(item.key, 'title', event.target.value)
              }
            />
            <TextField
              label={'Vai trò trong sản phẩm ' + (index + 1)}
              required
              maxLength={100}
              value={item.role}
              onChange={(event) =>
                updatePortfolio(item.key, 'role', event.target.value)
              }
              placeholder="Ví dụ: Phát triển API và triển khai"
            />
            <label className="block text-sm font-medium">
              Phần việc và kết quả
              <textarea
                rows={3}
                maxLength={800}
                value={item.description}
                onChange={(event) =>
                  updatePortfolio(item.key, 'description', event.target.value)
                }
                className={inputClass}
              />
            </label>
            <TextField
              label={'Liên kết sản phẩm ' + (index + 1)}
              type="url"
              maxLength={2048}
              value={item.url ?? ''}
              onChange={(event) =>
                updatePortfolio(item.key, 'url', event.target.value)
              }
            />
            {item.key === newProductKey && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <p className="text-xs text-muted">Lưu sản phẩm cùng các thay đổi trên hồ sơ trước khi thêm sản phẩm tiếp theo.</p>
                <Button type="submit" size="sm" loading={saving}>Lưu sản phẩm</Button>
              </div>
            )}
          </div>
        ))}
      </fieldset>
      <fieldset disabled={saving} className={panelClass + ' space-y-4'}>
        <legend className="sr-only">Quyền hiển thị</legend>
        <h2 className="text-lg font-semibold">Hiển thị hồ sơ</h2>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="mt-1"
          />
          <span>
            Công khai thông tin nghề nghiệp và portfolio để khách hàng, đội dev
            xem qua đường dẫn hồ sơ.
          </span>
        </label>
        <p className="text-xs leading-5 text-muted">
          Thông tin nghề nghiệp chỉ hiển thị khi bạn bật công khai. Nếu đã tham
          gia đội, tên, đội tham gia và ghi nhận hợp tác vẫn xuất hiện trong
          cộng đồng.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Button
            kind="ghost"
            disabled={saving}
            onClick={() => void onReload()}
          >
            Tải dữ liệu mới
          </Button>
          <Button type="submit" loading={saving}>
            Lưu hồ sơ nghề nghiệp
          </Button>
        </div>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </form>
  );
}
