import { AccountSecurityPanel, LogoutButton, useSession } from '../../auth';
import { BrowserPushSettings } from '../../notifications/pages/BrowserPushSettings';
import { ProfileForm } from '../components/ProfileForm';
import { useCommunityResource } from '../../community/community.api';
import type { ProfessionalProfile } from '../model/professional-profile';
import { ProfileHero } from '../components/ProfileHero';
import { Button } from '../../../shared/ui/Button';
import { Modal } from '../../../shared/ui/Modal';
import { AppearanceCard } from '../components/AppearanceCard';
import { useState } from 'react';
import { Tabs } from '../../../shared/ui/Tabs';
import { purposeLabels } from '../../../shared/account-purpose';
import { ProfessionalProfileSection } from '../components/ProfessionalProfileForm';

export function ProfilePage() {
  const session = useSession();
  const [tab, setTab] = useState<'professional' | 'account'>('professional');
  const [editing, setEditing] = useState<'avatar' | 'details' | null>(null);
  const client = session.status === 'authenticated' && session.user.accountPurpose === 'CLIENT';
  const professional = useCommunityResource<ProfessionalProfile>(session.status === 'authenticated' && !client ? 'community/profile' : null);
  if (session.status !== 'authenticated') return null;
  const headline = client ? undefined : professional.data?.headline || session.user.jobTitle;
  const accountPanel = (
    <div className="profile-layout">
      <div className="min-w-0">
        <LogoutButton />
        <AccountSecurityPanel />
        <BrowserPushSettings key={session.user.id} userId={session.user.id} />
      </div>
      <AppearanceCard />
    </div>
  );
  return (
    <div className="profile-page mx-auto w-full" aria-label="Trang cá nhân">
      <ProfileHero key={session.user.id} own userId={session.user.id} name={session.user.fullName}
        headline={headline} bio={session.user.bio ?? undefined} onEditAvatar={() => setEditing('avatar')}>
        <Button kind="secondary" onClick={() => setEditing('details')}>Chỉnh sửa trang cá nhân</Button>
      </ProfileHero>
      <Modal open={editing !== null} onClose={() => setEditing(null)}
        title={editing === 'avatar' ? 'Chỉnh sửa ảnh đại diện' : 'Chỉnh sửa trang cá nhân'}>
        {editing && <ProfileForm key={`${session.user.id}/${editing}`} user={session.user} mode={editing} showJobTitle={!client} onSaved={() => setEditing(null)} />}
      </Modal>
      <section className="my-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <div>
          <h2 className="text-sm font-semibold">
            Nhu cầu sử dụng ·{' '}
            {purposeLabels[session.user.accountPurpose ?? 'UNDECIDED']}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {session.user.onboardingStatus === 'COMPLETED'
              ? 'Bạn có thể thay đổi lựa chọn và thông tin hợp tác bất cứ lúc nào.'
              : 'Thiết lập đang để sau. Tiếp tục từ phần đã lưu khi bạn sẵn sàng.'}
          </p>
        </div>
        <a
          className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-accent"
          href="/setup?returnTo=%2Fprofile"
        >
          {session.user.onboardingStatus === 'COMPLETED'
            ? 'Cập nhật nhu cầu sử dụng'
            : 'Tiếp tục thiết lập'}
        </a>
      </section>
      {client ? (
        <details className="rounded-2xl border border-line bg-surface">
          <summary className="cursor-pointer rounded-2xl px-5 py-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent">
            Tài khoản & bảo mật
          </summary>
          <div className="border-t border-line p-4">{accountPanel}</div>
        </details>
      ) : (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'professional', label: 'Giới thiệu' },
              { value: 'account', label: 'Tài khoản & bảo mật' },
            ]}
          />
          {tab === 'professional' ? (
            <div className="mt-5 min-w-0 w-full">
              <ProfessionalProfileSection user={session.user} resource={professional} />
            </div>
          ) : accountPanel}
        </>
      )}
    </div>
  );
}
