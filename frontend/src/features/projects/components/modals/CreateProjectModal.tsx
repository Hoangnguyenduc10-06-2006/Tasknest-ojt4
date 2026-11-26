import { useRef, useState, type FormEvent } from 'react';
import { Modal } from '../../../../shared/ui/Modal';
import type { CreateProjectInput } from '../../model/project.types';
import { validateProjectForm } from '../../model/project.validation';

export interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateProjectInput) => Promise<void> | void;
  existingActiveProjectNames?: string[];
}

function formatVnDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d} thg ${parseInt(m, 10)}, ${y}`;
}

export function CreateProjectModal({
  open,
  onClose,
  onSubmit,
  existingActiveProjectNames = [],
}: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setErrors({});
  };

  const handleClose = () => {
    if (busy.current) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;

    const validation = validateProjectForm(
      { name, description, startDate, endDate },
      existingActiveProjectNames,
    );

    if (!validation.isValid) {
      setErrors(validation.errors as Record<string, string>);
      if (validation.errors.name) nameInputRef.current?.focus();
      else if (validation.errors.description) descInputRef.current?.focus();
      else if (validation.errors.startDate) startDateRef.current?.focus();
      else if (validation.errors.endDate) endDateRef.current?.focus();
      return;
    }

    setErrors({});
    busy.current = true;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), startDate, endDate });
      resetForm();
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Không thể tạo dự án. Vui lòng thử lại.' });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Tạo dự án mới"
      description="Bạn sẽ trở thành Owner của dự án."
      maxWidth="lg"
    >
      <form onSubmit={(event) => { void handleSubmit(event); }} noValidate className="space-y-5 text-ink">
        <fieldset disabled={saving} className="min-w-0 space-y-5">
          {errors.form && <p role="alert" className="text-sm text-danger">{errors.form}</p>}
          {/* ─── Tên dự án ─── */}
          <div>
            <label
              htmlFor="project-name-input"
              className="block text-xs font-semibold text-ink mb-1.5"
            >
              Tên dự án{' '}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </label>
            <div className="relative">
              <input
                ref={nameInputRef}
                id="project-name-input"
                type="text"
                maxLength={100}
                value={name}
                autoFocus
                autoComplete="off"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'project-name-error' : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                }}
                placeholder="Ví dụ: Ứng dụng khách hàng"
                className={`block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/50 transition focus:outline-hidden ${
                  errors.name
                    ? 'border-danger focus:border-danger ring-1 ring-danger/20'
                    : 'border-line focus:border-accent'
                }`}
              />
              {name && (
                <span className="absolute right-3 top-2.5 text-[11px] text-muted tabular-nums">
                  {name.length}/100
                </span>
              )}
            </div>
            {errors.name && (
              <p
                id="project-name-error"
                className="mt-1.5 flex items-center gap-1 text-xs text-danger"
                role="alert"
              >
                <svg
                  className="size-3.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                {errors.name}
              </p>
            )}
          </div>

          {/* ─── Mô tả ─── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="project-desc-input"
                className="block text-xs font-semibold text-ink"
              >
                Mô tả
              </label>
              <span className="text-[11px] text-muted tabular-nums">
                {description.length}/500
              </span>
            </div>
            <textarea
              ref={descInputRef}
              id="project-desc-input"
              rows={4}
              maxLength={500}
              value={description}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? 'project-desc-error' : undefined
              }
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description)
                  setErrors((prev) => ({ ...prev, description: '' }));
              }}
              placeholder="Mục tiêu và phạm vi ngắn gọn của dự án..."
              className={`block w-full resize-none rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/50 transition focus:outline-hidden ${
                errors.description
                  ? 'border-danger focus:border-danger ring-1 ring-danger/20'
                  : 'border-line focus:border-accent'
              }`}
            />
            {errors.description && (
              <p
                id="project-desc-error"
                className="mt-1.5 flex items-center gap-1 text-xs text-danger"
                role="alert"
              >
                <svg
                  className="size-3.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                {errors.description}
              </p>
            )}
          </div>

          {/* ─── Ngày bắt đầu / Kết thúc dự kiến ─── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="project-start-date"
                className="block text-xs font-semibold text-ink mb-1.5"
              >
                Ngày bắt đầu{' '}
                <span className="text-danger" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                ref={startDateRef}
                id="project-start-date"
                type="date"
                value={startDate}
                aria-invalid={Boolean(errors.startDate)}
                aria-describedby={
                  errors.startDate ? 'project-start-error' : undefined
                }
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (errors.startDate)
                    setErrors((prev) => ({ ...prev, startDate: '' }));
                }}
                className={`block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink transition focus:outline-hidden [color-scheme:dark] ${
                  errors.startDate
                    ? 'border-danger focus:border-danger ring-1 ring-danger/20'
                    : 'border-line focus:border-accent'
                }`}
              />
              {errors.startDate && (
                <p
                  id="project-start-error"
                  className="mt-1.5 text-xs text-danger"
                  role="alert"
                >
                  {errors.startDate}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="project-end-date"
                className="block text-xs font-semibold text-ink mb-1.5"
              >
                Kết thúc dự kiến{' '}
                <span className="text-danger" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                ref={endDateRef}
                id="project-end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                aria-invalid={Boolean(errors.endDate)}
                aria-describedby={
                  errors.endDate ? 'project-end-error' : undefined
                }
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (errors.endDate)
                    setErrors((prev) => ({ ...prev, endDate: '' }));
                }}
                className={`block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink transition focus:outline-hidden [color-scheme:dark] ${
                  errors.endDate
                    ? 'border-danger focus:border-danger ring-1 ring-danger/20'
                    : 'border-line focus:border-accent'
                }`}
              />
              {errors.endDate && (
                <p
                  id="project-end-error"
                  className="mt-1.5 text-xs text-danger"
                  role="alert"
                >
                  {errors.endDate}
                </p>
              )}
            </div>
          </div>

          {/* Date range hint */}
          {(startDate || endDate) && (
            <p className="text-[11px] leading-relaxed text-muted -mt-2">
              {startDate && endDate ? (
                <>
                  Từ{' '}
                  <span className="font-medium text-ink">
                    {formatVnDate(startDate)}
                  </span>{' '}
                  đến{' '}
                  <span className="font-medium text-ink">
                    {formatVnDate(endDate)}
                  </span>
                  . Ngày bắt đầu được phép trong quá khứ. Thay lịch dự án không tự
                  đổi deadline nhiệm vụ.
                </>
              ) : (
                <>
                  Ngày kết thúc không được trước ngày bắt đầu. Bạn là Owner của dự
                  án sau khi tạo.
                </>
              )}
            </p>
          )}

          {!startDate && !endDate && (
            <p className="text-[11px] leading-relaxed text-muted -mt-2">
              Ngày bắt đầu được phép trong quá khứ. Bạn là Owner của dự án sau khi
              tạo.
            </p>
          )}

          {/* ─── Footer buttons ─── */}
          <div className="flex items-center justify-end gap-2.5 border-t border-line/60 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-xs transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
            >
              <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              {saving ? 'Đang tạo...' : 'Tạo dự án'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
