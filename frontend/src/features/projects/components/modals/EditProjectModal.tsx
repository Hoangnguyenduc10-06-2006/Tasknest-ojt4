import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../../shared/api/client';
import { Modal } from '../../../../shared/ui/Modal';
import { useSession } from '../../../auth';
import { getProject, updateProject } from '../../api/project.api';
import { acceptProject } from '../../model/project.store';
import type {
  MyProjectItem,
  ProjectFormData,
  UpdateProjectInput,
} from '../../model/project.types';
import {
  canEditProject,
  formatProjectDateRange,
  normalizeProjectName,
  validateProjectForm,
} from '../../model/project.validation';

export interface EditProjectModalProps {
  open: boolean;
  project: MyProjectItem | null;
  onClose: () => void;
  onSubmit?: (updated: UpdateProjectInput) => void;
  existingActiveProjectNames?: string[];
  save?: typeof updateProject;
}

interface EditProjectFormProps {
  project: MyProjectItem;
  onClose: () => void;
  onSubmit?: EditProjectModalProps['onSubmit'];
  existingActiveProjectNames: string[];
  save: typeof updateProject;
  onBusyChange: (busy: boolean) => void;
}

function EditProjectForm({
  project,
  onClose,
  onSubmit,
  existingActiveProjectNames,
  save,
  onBusyChange,
}: EditProjectFormProps) {
  const session = useSession();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [startDate, setStartDate] = useState(project.startDate || '');
  const [endDate, setEndDate] = useState(project.endDate || '');
  const [version, setVersion] = useState(project.version);
  const [saving, setSaving] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const nameInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy.current) return;

    if (!canEditProject(project)) {
      setErrors({
        form: 'Chỉ Owner hoặc Manager mới được chỉnh sửa dự án đang hoạt động.',
      });
      return;
    }

    // Exclude current project's own name from duplicate check
    const normalizedCurrentName = normalizeProjectName(project.name);
    const otherNames = (project.role === 'Owner' ? existingActiveProjectNames : []).filter(
      (n) =>
        normalizeProjectName(n).toLowerCase() !==
        normalizedCurrentName.toLowerCase(),
    );

    const validation = validateProjectForm(
      { name, description, startDate, endDate } as ProjectFormData,
      otherNames,
    );

    if (!validation.isValid) {
      setErrors(validation.errors as Record<string, string>);
      if (validation.errors.name) {
        nameInputRef.current?.focus();
      } else if (validation.errors.description) {
        descInputRef.current?.focus();
      } else if (validation.errors.startDate) {
        startDateRef.current?.focus();
      } else if (validation.errors.endDate) {
        endDateRef.current?.focus();
      }
      return;
    }

    if (version === undefined) {
      setErrors({
        form: 'Không thể tải phiên bản dự án. Vui lòng tải lại trang.',
      });
      return;
    }

    if (session.status !== 'authenticated') {
      setErrors({
        form: 'Vui lòng đăng nhập lại trước khi lưu thay đổi.',
      });
      return;
    }

    busy.current = true;
    setSaving(true);
    onBusyChange(true);
    setErrors({});
    try {
      const normalizedName = normalizeProjectName(name);
      const trimmedDescription = description.trim();
      const saved = await save(session.user.id, project.id, {
        name: normalizedName,
        description: trimmedDescription,
        startsOn: startDate,
        endsOn: endDate,
        version,
      });
      if (!mounted.current) return;
      acceptProject(session.user.id, saved);
      setVersion(saved.version);
      onSubmit?.({
        id: project.id,
        name: saved.name,
        description: saved.description,
        startDate: saved.startsOn,
        endDate: saved.endsOn,
        version: saved.version,
      });
      onClose();
    } catch (error) {
      if (!mounted.current) return;
      setErrors({
        form:
          error instanceof ApiError && error.status === 409
            ? error.message ||
              'Dự án đã thay đổi. Nội dung đang nhập được giữ lại; hãy nạp phiên bản mới trước khi lưu.'
            : error instanceof Error
              ? error.message
              : 'Không thể cập nhật dự án. Vui lòng thử lại.',
      });
      if (error instanceof ApiError && error.status === 409) {
        try {
          const latest = await getProject(session.user.id, project.id);
          if (mounted.current) acceptProject(session.user.id, latest);
        } catch {
          // Keep the draft and original save error if refreshing is unavailable.
        }
      }
    } finally {
      busy.current = false;
      onBusyChange(false);
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      noValidate
      className="space-y-4 text-ink"
    >
      <fieldset disabled={saving} className="min-w-0 space-y-4">
        {project.version !== version && (
          <p role="status" className="rounded-xl border border-accent/40 p-3 text-xs text-muted">
            Dự án có phiên bản mới. Nội dung bạn đang nhập được giữ lại.
            {confirmReload ? <>
              <span className="block mt-2">Nạp phiên bản mới sẽ thay nội dung bạn đang nhập.</span>
              <button type="button" className="mr-3 font-semibold text-accent" onClick={() => {
                setName(project.name); setDescription(project.description);
                setStartDate(project.startDate || ''); setEndDate(project.endDate || '');
                setVersion(project.version); setErrors({}); setConfirmReload(false);
              }}>Bỏ thay đổi và nạp</button>
              <button type="button" onClick={() => setConfirmReload(false)}>Tiếp tục sửa</button>
            </> : <button type="button" className="ml-2 font-semibold text-accent" onClick={() => setConfirmReload(true)}>Nạp phiên bản mới</button>}
          </p>
        )}
        {errors.form && (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-xs text-danger" role="alert">
            {errors.form}
          </p>
        )}
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="edit-project-name" className="block text-xs font-semibold text-ink">
              Tên dự án <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <span className="text-[11px] text-muted">{name.length}/100</span>
          </div>
          <input
            ref={nameInputRef}
            id="edit-project-name"
            type="text"
            maxLength={100}
            value={name}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'edit-project-name-error' : undefined}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
            className={`mt-1.5 block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink transition focus:outline-hidden ${
              errors.name ? 'border-danger focus:border-danger' : 'border-line focus:border-accent'
            }`}
          />
          {errors.name && (
            <p id="edit-project-name-error" className="mt-1.5 text-xs text-danger" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="edit-project-desc" className="block text-xs font-semibold text-ink">
              Mô tả dự án <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <span className="text-[11px] text-muted">{description.length}/500</span>
          </div>
          <textarea
            ref={descInputRef}
            id="edit-project-desc"
            rows={3}
            maxLength={500}
            value={description}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'edit-project-desc-error' : undefined}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
            }}
            className={`mt-1.5 block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink transition focus:outline-hidden ${
              errors.description ? 'border-danger focus:border-danger' : 'border-line focus:border-accent'
            }`}
          />
          {errors.description && (
            <p id="edit-project-desc-error" className="mt-1.5 text-xs text-danger" role="alert">
              {errors.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-project-start-date" className="block text-xs font-semibold text-ink">
              Ngày bắt đầu dự kiến <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              ref={startDateRef}
              id="edit-project-start-date"
              type="date"
              value={startDate}
              aria-invalid={Boolean(errors.startDate)}
              aria-describedby={errors.startDate ? 'edit-project-start-error' : undefined}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: '' }));
              }}
              className={`mt-1.5 block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink transition focus:outline-hidden ${
                errors.startDate ? 'border-danger focus:border-danger' : 'border-line focus:border-accent'
              }`}
            />
            {errors.startDate && (
              <p id="edit-project-start-error" className="mt-1.5 text-xs text-danger" role="alert">
                {errors.startDate}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="edit-project-end-date" className="block text-xs font-semibold text-ink">
              Ngày kết thúc dự kiến <span className="text-danger" aria-hidden="true">*</span>
            </label>
            <input
              ref={endDateRef}
              id="edit-project-end-date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              aria-invalid={Boolean(errors.endDate)}
              aria-describedby={errors.endDate ? 'edit-project-end-error' : undefined}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (errors.endDate) setErrors((prev) => ({ ...prev, endDate: '' }));
              }}
              className={`mt-1.5 block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink transition focus:outline-hidden ${
                errors.endDate ? 'border-danger focus:border-danger' : 'border-line focus:border-accent'
              }`}
            />
            {errors.endDate && (
              <p id="edit-project-end-error" className="mt-1.5 text-xs text-danger" role="alert">
                {errors.endDate}
              </p>
            )}
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted">
          {startDate && endDate ? (
            <>
              Lịch dự kiến:{' '}
              <span className="font-medium text-ink">
                {formatProjectDateRange(startDate, endDate)}
              </span>
              . Ngày bắt đầu được phép trong quá khứ. Thay đổi lịch dự án không tự
              đổi ngày bắt đầu hoặc deadline nhiệm vụ.
            </>
          ) : (
            <>
              Ngày bắt đầu được phép trong quá khứ. Thay đổi lịch dự án không tự
              đổi ngày bắt đầu hoặc deadline nhiệm vụ.
            </>
          )}
        </p>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-line/60">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-xs transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export function EditProjectModal({
  open,
  project,
  onClose,
  onSubmit,
  existingActiveProjectNames = [],
  save = updateProject,
}: EditProjectModalProps) {
  const busy = useRef(false);
  if (!project || !canEditProject(project)) return null;

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy.current) onClose(); }}
      title="Chỉnh sửa thông tin dự án"
      description="Cập nhật tên, mô tả hoặc thời gian thực hiện dự án."
      maxWidth="md"
    >
      <EditProjectForm
        key={project.id}
        project={project}
        onClose={onClose}
        onSubmit={onSubmit}
        existingActiveProjectNames={existingActiveProjectNames}
        onBusyChange={(value) => { busy.current = value; }}
        save={save}
      />
    </Modal>
  );
}
