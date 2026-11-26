import type { DirectInvitation } from '../model/invitation.types';
import { ProjectAvatar } from './ProjectAvatar';
import { StatusBadge } from './StatusBadge';

interface DirectInvitationItemProps {
  invitation: DirectInvitation;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
}

export function DirectInvitationItem({
  invitation,
  onAccept,
  onDecline,
}: DirectInvitationItemProps) {
  const isPending = invitation.status === 'PENDING';
  const isProjectArchived = Boolean(invitation.projectArchived);

  return (
    <div className="group flex flex-col gap-4 p-4 transition-colors hover:bg-surface/50 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      {/* Left: Project Icon & Title */}
      <div className="flex items-center gap-3.5 sm:w-1/3 sm:min-w-[200px]">
        <ProjectAvatar
          code={invitation.projectCode}
          name={invitation.projectName}
          colorClass={invitation.projectColor}
        />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink sm:text-base">
            {invitation.projectName}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{invitation.invitedAt}</p>
        </div>
      </div>

      {/* Center: Inviter info & Message */}
      <div className="flex-1 text-sm sm:px-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink/90">
          <span>Mời bởi:</span>
          <span className="font-semibold text-accent">{invitation.inviterName}</span>
          <span className="text-muted">({invitation.inviterRole})</span>
          <span className="text-muted">•</span>
          <span className="rounded-md bg-field px-1.5 py-0.5 text-[11px] text-muted border border-line">
            Vai trò: {invitation.role}
          </span>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-muted">{invitation.message}</p>
      </div>

      {/* Right: Actions or Status */}
      <div className="flex items-center justify-between gap-2.5 self-end sm:self-center sm:justify-end">
        {isPending && !isProjectArchived ? (
          <>
            <button
              type="button"
              onClick={() => onAccept?.(invitation.id)}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-on-accent shadow-xs transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
            >
              Chấp nhận
            </button>
            <button
              type="button"
              onClick={() => onDecline?.(invitation.id)}
              className="inline-flex items-center justify-center rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-danger/40 hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-danger"
            >
              Từ chối
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <StatusBadge status={invitation.status} />
            {isPending && isProjectArchived && (
              <span className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-[11px] font-medium text-muted">
                Dự án đã lưu trữ (Chỉ xem)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
