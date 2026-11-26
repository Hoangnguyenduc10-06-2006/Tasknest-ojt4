import { RoleBadge } from '../../../shared/ui/RoleBadge';
import { Badge } from '../../../shared/ui/Badge';
import { useEffect, useRef, useState } from 'react';
import type { MyProjectItem } from '../model/project.types';

export interface ProjectCardProps {
  project: MyProjectItem;
  onArchiveToggle?: (id: string) => void;
  onEdit?: (project: MyProjectItem) => void;
  hasRunningTimer?: boolean;
  isArchiving?: boolean;
}

export function ProjectCard({
  project,
  onArchiveToggle,
  onEdit,
  hasRunningTimer = false,
  isArchiving = false,
}: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isActive = project.status === 'ACTIVE';
  const completed = isActive && project.developmentState === 'COMPLETED';
  const isOwner = project.role === 'Owner' && !completed;
  const isManagerOrOwner =
    !completed && (project.role === 'Owner' || project.role === 'Manager');

  const projectHref = `/projects/${encodeURIComponent(project.id)}`;
  // Close menu on click outside or Escape key
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="catalog-card group relative">
      <div>
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3">
          {/* Project Avatar / Code */}
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl border text-xs font-bold select-none ${project.iconBgClass}`}
          >
            {project.imageUrl ? (
              <img
                src={project.imageUrl}
                alt=""
                className="size-full rounded-xl object-cover"
              />
            ) : (
              project.code
            )}
          </span>

          {/* Right Status Badge & Menu */}
          <div className="flex items-center gap-2">
            <Badge tone={isActive && !completed ? 'green' : 'neutral'}>{completed ? 'Đã hoàn thành' : isActive ? 'Đang hoạt động' : 'Đã lưu trữ'}</Badge>

            {/* Three-dots menu */}
            <div className="relative">
              <button
                ref={buttonRef}
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label={`Tùy chọn dự án ${project.name}`}
                className="flex size-7 items-center justify-center rounded-lg text-muted transition hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  ref={menuRef}
                  role="menu"
                  aria-label="Tùy chọn dự án"
                  className="absolute right-0 top-8 z-30 w-44 rounded-xl border border-line bg-surface p-1.5 text-xs text-ink shadow-xl animate-in fade-in zoom-in-95"
                >
                  <a
                    href={projectHref}
                    data-project-link
                    role="menuitem"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted transition hover:bg-field hover:text-ink"
                  >
                    <svg
                      className="size-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                      />
                    </svg>
                    Mở dự án
                  </a>

                  {isActive && isManagerOrOwner && onEdit && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(project);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-muted transition hover:bg-field hover:text-ink"
                    >
                      <svg
                        className="size-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                        />
                      </svg>
                      Chỉnh sửa thông tin
                    </button>
                  )}

                  {onArchiveToggle && (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={
                        !isOwner ||
                        isArchiving ||
                        (isActive && hasRunningTimer)
                      }
                      onClick={() => {
                        if (
                          isOwner &&
                          !isArchiving &&
                          !(isActive && hasRunningTimer)
                        ) {
                          onArchiveToggle(project.id);
                          setMenuOpen(false);
                        }
                      }}
                      title={
                        !isOwner
                          ? 'Chỉ Owner mới có quyền lưu trữ hoặc mở lại dự án (PRJ-04)'
                          : isActive && hasRunningTimer
                            ? 'Không thể lưu trữ dự án khi vẫn còn phiên ghi giờ đang chạy (PRJ-07)'
                            : undefined
                      }
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition ${
                        isOwner &&
                        !isArchiving &&
                        !(isActive && hasRunningTimer)
                          ? 'text-muted hover:bg-field hover:text-ink'
                          : 'cursor-not-allowed opacity-50 text-muted'
                      }`}
                    >
                      <svg
                        className="size-3.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        {isActive ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                          />
                        )}
                      </svg>
                      <span>
                        {isArchiving
                          ? 'Đang xử lý...'
                          : isActive
                            ? 'Lưu trữ dự án'
                            : 'Khôi phục dự án'}
                        {!isOwner && (
                          <span className="block text-[10px] text-muted">
                            (Chỉ Owner)
                          </span>
                        )}
                        {isOwner && isActive && hasRunningTimer && (
                          <span className="block text-[10px] text-amber-500">
                            (Đang có phiên ghi giờ chạy)
                          </span>
                        )}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Title & Link */}
        <h3 className="mt-3.5 text-base font-bold text-ink">
          <a
            href={projectHref}
            data-project-link
            className="transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            {project.name}
          </a>
        </h3>

        {/* Description */}
        <p className="mt-1.5 text-xs leading-relaxed text-muted line-clamp-2 min-h-[34px]">
          {project.description}
        </p>

        {/* Info Rows: Role + Date range */}
        <div className="mt-4 space-y-2 text-xs text-muted">
          {/* Role Row */}
          <div className="flex items-center gap-2">
            <svg
              className="size-3.5 shrink-0 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
            <RoleBadge role={project.role} />
          </div>

          {/* Date range Row */}
          <div className="flex items-center gap-2">
            <svg
              className="size-3.5 shrink-0 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 7.5h18M4.5 7.5v12a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-12"
              />
            </svg>
            <span>{project.dateRange}</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Progress bar & Timestamp */}
      <div className="mt-5 border-t border-line/60 pt-3.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Tiến độ hiện tại</span>
          <span className="font-bold text-ink">
            {project.taskCount === 0
              ? 'Chưa có nhiệm vụ'
              : `${project.progress}%`}
          </span>
        </div>

        {/* Progress Track */}
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-field">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${project.progress}%` }}
          />
        </div>

        {/* Updated timestamp footer */}
        <p className="mt-3 text-[11px] text-muted">{project.updatedAt}</p>
      </div>
    </div>
  );
}
