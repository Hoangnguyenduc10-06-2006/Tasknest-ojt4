import { PageHeader } from '../../../shared/ui/PageHeader';
import { Tabs } from '../../../shared/ui/Tabs';
import { Button } from '../../../shared/ui/Button';
import { countActionableInvitations } from '../model/invitation.selectors';
import { respondInvitation, cancelJoinRequest } from '../api/invitation.api';
import { useRef, useState } from 'react';
import { useWorkspace } from '../../workspace';
import { loadProjects } from '../model/project.store';
import type { PersonalInvitationTab } from '../model/invitation.types';
import { DirectInvitationItem } from './DirectInvitationItem';
import { SentRequestItem } from './SentRequestItem';
import { InviteLinkQrModal } from './modals/InviteLinkQrModal';

export interface PersonalInvitationsViewProps {
  /** Optional custom class for outer wrapper */
  className?: string;
  /** Optional initial active tab */
  defaultTab?: PersonalInvitationTab;
}

export function PersonalInvitationsView({
  className = '',
  defaultTab = 'direct_invitations',
}: PersonalInvitationsViewProps) {
  const [activeTab, setActiveTab] = useState<PersonalInvitationTab>(()=>new URLSearchParams(window.location.search).get('tab')==='requests'?'sent_requests':defaultTab);
  const workspace = useWorkspace();
  const sentRequests = workspace.data?.joinRequests ?? [];
  const directInvitations = workspace.data?.invitations ?? [];
  const busy = useRef(false);
  const [error, setError] = useState<string>();
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 3200);
  };

  const act = async (id: string, action: 'accept' | 'decline' | 'cancel') => {
    if (!workspace.userId || busy.current) return;
    const item =
      action === 'cancel'
        ? sentRequests.find((item) => item.id === id)
        : directInvitations.find((item) => item.id === id);
    if (!item) return;
    if (item.projectArchived) {
      setError('Dự án đã lưu trữ chỉ được xem lại.');
      return;
    }
    busy.current = true;
    setError(undefined);
    try {
      if (action === 'cancel')
        await cancelJoinRequest(workspace.userId, item.projectId, id);
      else
        await respondInvitation(workspace.userId, item.projectId, id, action);
      await workspace.refresh();
      if (action === 'accept') await loadProjects(workspace.userId);
      showToast(
        action === 'accept'
          ? 'Đã tham gia dự án.'
          : action === 'decline'
            ? 'Đã từ chối lời mời.'
            : 'Đã hủy yêu cầu.',
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Không thể lưu thao tác.',
      );
    } finally {
      busy.current = false;
    }
  };
  const handleCancelRequest = (id: string) => {
    void act(id, 'cancel');
  };
  const handleAcceptInvitation = (id: string) => {
    void act(id, 'accept');
  };
  const handleDeclineInvitation = (id: string) => {
    void act(id, 'decline');
  };

  // Counts for tab badges
  const pendingRequestsCount = sentRequests.filter(
    (r) =>
      r.status === 'PENDING' ||
      r.status === 'ACCEPTED' ||
      r.status === 'REJECTED',
  ).length;

  const pendingInvitationsCount = countActionableInvitations(directInvitations);

  return (
    <div className={`w-full space-y-6 ${className}`}>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger p-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink shadow-lg animate-in slide-in-from-bottom-5"
        >
          <span className="flex size-2 rounded-full bg-accent" />
          <span>{toastMessage}</span>
        </div>
      )}

      <PageHeader eyebrow="KHÔNG GIAN CÁ NHÂN" title="Lời mời & yêu cầu của tôi" description="Theo dõi quyền tham gia dự án của tài khoản này." actions={<Button kind="secondary" icon="users" onClick={() => setIsQrModalOpen(true)}>Nhập liên kết tham gia</Button>} />
      <Tabs value={activeTab} onChange={setActiveTab} items={[
        { value: 'direct_invitations', label: 'Lời mời trực tiếp', count: pendingInvitationsCount > 0 ? pendingInvitationsCount : directInvitations.length },
        { value: 'sent_requests', label: 'Yêu cầu đã gửi', count: pendingRequestsCount },
      ]} />

      {/* Main Content List Container */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface/70 shadow-xs backdrop-blur-xs">
        {activeTab === 'sent_requests' ? (
          sentRequests.length > 0 ? (
            <div className="divide-y divide-line/70">
              {sentRequests.map((request) => (
                <SentRequestItem
                  key={request.id}
                  request={request}
                  onCancelRequest={handleCancelRequest}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-line bg-canvas text-muted">
                <svg
                  className="size-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-ink">
                Chưa có yêu cầu tham gia nào
              </h3>
              <p className="mt-1 text-xs text-muted max-w-sm">
                Bạn chưa gửi yêu cầu tham gia vào dự án nào. Bạn có thể sử dụng
                link hoặc mã QR để yêu cầu tham gia.
              </p>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="mt-4 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-on-accent transition hover:bg-accent-hover"
              >
                Nhập liên kết tham gia
              </button>
            </div>
          )
        ) : directInvitations.length > 0 ? (
          <div className="divide-y divide-line/70">
            {directInvitations.map((invitation) => (
              <DirectInvitationItem
                key={invitation.id}
                invitation={invitation}
                onAccept={handleAcceptInvitation}
                onDecline={handleDeclineInvitation}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-line bg-canvas text-muted">
              <svg
                className="size-7"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-ink">
              Không có lời mời nào
            </h3>
            <p className="mt-1 text-xs text-muted max-w-sm">
              Hiện tại chưa có dự án nào gửi lời mời trực tiếp đến tài khoản
              này.
            </p>
          </div>
        )}
      </div>

      {/* Join link modal */}
      <InviteLinkQrModal
        open={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </div>
  );
}
