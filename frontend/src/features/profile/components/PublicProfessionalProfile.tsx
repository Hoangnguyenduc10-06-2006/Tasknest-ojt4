import {
  availabilityLabels,
  collaborationLabels,
  type ProfessionalProfile,
} from '../model/professional-profile';
import { panelClass } from '../../community/community.api';
import { Icon } from '../../../shared/ui/Icon';

export function PublicProfessionalProfile({
  profile,
}: {
  profile: ProfessionalProfile;
}) {
  const links = [
    { label: 'GitHub', url: profile.github_url },
    { label: 'LinkedIn', url: profile.linkedin_url },
    { label: 'Website', url: profile.website_url },
    { label: 'Liên kết khác', url: profile.social_url },
    { label: 'Email', url: profile.contact_email ? 'mailto:' + encodeURIComponent(profile.contact_email).replace('%40', '@') : null },
  ].filter((link) => link.url);
  const availability = profile.availability ?? 'BUSY';
  const availabilityTone =
    availability === 'AVAILABLE'
      ? 'bg-success-soft text-success'
      : availability === 'LOOKING_FOR_TEAM'
        ? 'bg-tint text-accent'
        : 'bg-panel text-muted';

  return (
    <div className="space-y-6">
      <section className={panelClass + ' overflow-hidden !p-0'}>
        <div className="h-1.5 bg-gradient-to-r from-accent/80 via-accent/35 to-transparent" />
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                Hồ sơ nghề nghiệp
              </p>
              <h2 className="mt-1 text-xl font-semibold">Giới thiệu chuyên môn</h2>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${availabilityTone}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {availabilityLabels[availability] ?? availabilityLabels.BUSY}
            </span>
          </div>
          {profile.about ? (
            <p className="max-w-4xl whitespace-pre-wrap break-words text-sm leading-7 text-ink/90">
              {profile.about}
            </p>
          ) : (
            <p className="text-sm text-muted">Chưa có phần giới thiệu.</p>
          )}
          {(profile.location || profile.experience_years != null || profile.weekly_hours != null) && (
            <div className="grid gap-2 border-t border-line pt-4 sm:grid-cols-3">
              {profile.location && (
                <ProfileFact label="Khu vực" value={profile.location} />
              )}
              {profile.experience_years != null && (
                <ProfileFact
                  label="Kinh nghiệm"
                  value={
                    profile.experience_years === 0
                      ? 'Đang bắt đầu sự nghiệp'
                      : `${profile.experience_years} năm`
                  }
                />
              )}
              {profile.weekly_hours != null && (
                <ProfileFact
                  label="Thời gian có thể tham gia"
                  value={`${profile.weekly_hours} giờ / tuần`}
                />
              )}
            </div>
          )}
        {!!profile.skills?.length && (
          <div className="border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Kỹ năng chính</h3>
              <span className="text-xs text-muted">{profile.skills.length} kỹ năng</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="max-w-full break-words rounded-full border border-accent/15 bg-tint px-3 py-1.5 text-xs font-medium text-accent"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
        {(!!profile.desired_roles?.length || !!profile.collaboration_modes?.length) && (
          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
            {!!profile.desired_roles?.length && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Vị trí mong muốn</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.desired_roles.map((role) => (
                    <span key={role} className="rounded-lg bg-panel px-3 py-1.5 text-sm">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!!profile.collaboration_modes?.length && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Hình thức hợp tác</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.collaboration_modes
                    .map((mode) => collaborationLabels[mode])
                    .filter(Boolean)
                    .map((mode) => (
                      <span key={mode} className="rounded-lg bg-panel px-3 py-1.5 text-sm text-muted">
                        {mode}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!!links.length && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-accent transition hover:border-accent/50 hover:bg-tint focus-visible:outline-2 focus-visible:outline-accent"
              >
                {link.label}
                <Icon name="arrow" size={14} />
              </a>
            ))}
          </div>
        )}
        </div>
      </section>
      {!!profile.portfolio_items?.length && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                Kinh nghiệm thực tế
              </p>
              <h2 className="mt-1 text-xl font-semibold">Sản phẩm tiêu biểu</h2>
            </div>
            <p className="text-xs text-muted">
              {profile.portfolio_items.length} sản phẩm
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {profile.portfolio_items.map((item, index) => (
              <article
                key={index}
                className={panelClass + ' group flex min-w-0 flex-col gap-3 transition hover:border-accent/40 hover:shadow-sm'}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tint text-sm font-bold text-accent">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-semibold">
                      {item.title}
                    </h3>
                    <p className="mt-1 break-words text-sm font-medium text-accent">
                      {item.role}
                    </p>
                  </div>
                </div>
                {item.description && (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted">
                    {item.description}
                  </p>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center gap-2 border-t border-line pt-3 text-sm font-semibold text-accent transition group-hover:gap-3 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    Xem sản phẩm
                    <Icon name="arrow" size={15} />
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-panel px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
