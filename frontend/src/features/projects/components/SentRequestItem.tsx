import type { JoinRequest } from '../model/invitation.types';
import { ProjectAvatar } from './ProjectAvatar';
import { StatusBadge } from './StatusBadge';

interface SentRequestItemProps {
  request: JoinRequest;
  onCancelRequest?: (id: string) => void;
}

export function SentRequestItem({ request, onCancelRequest }: SentRequestItemProps) {
  const isProjectArchived = Boolean(request.projectArchived);
  const canCancel = request.status === 'PENDING' && !isProjectArchived;

  return (
    <div className="group flex flex-col gap-4 p-4 transition-colors hover:bg-surface/50 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      {/* Left: Project Icon & Title */}
      <div className="flex items-center gap-3.5 sm:w-1/3 sm:min-w-[200px]">
        <ProjectAvatar
          code={request.projectCode}
          name={request.projectName}
          colorClass={request.projectColor}
        />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink sm:text-base">
            {request.projectName}
          </h3>
          <p className="mt-0.5 text-xs text-muted">
            {request.sentAt}
          </p>
        </div>
      </div>

      {/* Center: Request Message / Note */}
      <div className="flex-1 text-sm text-ink/80 sm:px-4">
        <p className="line-clamp-2 leading-relaxed text-muted/90 dark:text-muted">
          {request.message}
        </p>
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center justify-between gap-4 self-end sm:self-center sm:justify-end">
        <StatusBadge status={request.status} />

        {canCancel && onCancelRequest ? (
          <button
            type="button"
            onClick={() => onCancelRequest(request.id)}
            className="text-xs font-medium text-muted transition hover:text-danger hover:underline focus-visible:outline-2 focus-visible:outline-danger"
          >
            Hủy yêu cầu
          </button>
        ) : request.status === 'PENDING' && isProjectArchived ? (
          <span className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-[11px] font-medium text-muted">
            Dự án đã lưu trữ (Chỉ xem)
          </span>
        ) : (
          <div className="w-16" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
