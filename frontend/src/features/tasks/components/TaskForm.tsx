import { useState, type FormEvent } from 'react';
import type { TaskAssignee } from '../model/task.types';
import type {
  CreateTaskInput,
  TaskFormErrors,
  TaskPriority,
} from '../model/task.types';
import { validateCreateTask } from '../model/task.validation';

export interface TaskFormProps {
  members: TaskAssignee[];
  submitLabel?: string;
  projectRange?: { startDate?: string; endDate?: string };
  initialValues?: Partial<CreateTaskInput>;
  onSubmit: (input: CreateTaskInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  role: 'Owner' | 'Manager' | 'Member' | 'Customer';
}

export function TaskForm({
  initialValues,
  submitLabel = 'Tạo nhiệm vụ',
  projectRange,
  members,
  role,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(
    initialValues?.description ?? '',
  );
  const [assigneeId, setAssigneeId] = useState(
    initialValues?.assigneeId ??
      members.find((member) => member.isCurrentUser)?.id ??
      '',
  );
  const [priority, setPriority] = useState<TaskPriority>(
    initialValues?.priority ?? 'MEDIUM',
  );
  const [startDate, setStartDate] = useState(
    initialValues?.startDate ??
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
  );
  const [deadline, setDeadline] = useState(initialValues?.deadline ?? '');
  const [estimatedHours, setEstimatedHours] = useState<number | string>(
    initialValues?.estimatedHours ?? 3,
  );
  const [errors, setErrors] = useState<TaskFormErrors>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const inputData: CreateTaskInput = {
      title,
      startDate,
      description,
      assigneeId,
      priority,
      deadline: deadline ? deadline : undefined,
      estimatedHours:
        typeof estimatedHours === 'string'
          ? parseFloat(estimatedHours)
          : estimatedHours,
    };

    const validation = validateCreateTask(inputData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    onSubmit(inputData);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 text-ink">
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
        {/* 1. Tên nhiệm vụ */}
        <div>
          <label
            htmlFor="task-title-input"
            className="block text-xs font-semibold text-ink"
          >
            Tên nhiệm vụ{' '}
            <span className="text-danger" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="task-title-input"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title)
                setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            placeholder="Nhập tên nhiệm vụ..."
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'task-title-error' : undefined}
            className={`mt-1.5 block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 transition focus:outline-hidden ${
              errors.title
                ? 'border-danger focus:ring-1 focus:ring-danger'
                : 'border-line focus:border-accent'
            }`}
          />
          {errors.title && (
            <p id="task-title-error" className="mt-1 text-xs text-danger">
              {errors.title}
            </p>
          )}
        </div>

        {/* 2. Mô tả */}
        <div>
          <label
            htmlFor="task-desc-input"
            className="block text-xs font-semibold text-ink"
          >
            Mô tả
          </label>
          <textarea
            id="task-desc-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả chi tiết nội dung, kết quả cần bàn giao..."
            className="mt-1.5 block w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/60 transition focus:border-accent focus:outline-hidden"
          />
        </div>

        {/* 3. Grid 2 cols: Người phụ trách + Ưu tiên */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Người phụ trách */}
          <div>
            <label
              htmlFor="task-assignee-select"
              className="block text-xs font-semibold text-ink"
            >
              Người phụ trách
            </label>
            <select
              id="task-assignee-select"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink transition focus:border-accent focus:outline-hidden"
            >
              {members
                .filter((member) => member.role !== 'Customer' && (role !== 'Member' || member.isCurrentUser))
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              {role === 'Member'
                ? 'Bạn có thể tạo nhiệm vụ cho chính mình.'
                : 'Bạn có thể phân công cho thành viên trong dự án.'}{' '}
              Mỗi nhiệm vụ có một người phụ trách.
            </p>
          </div>

          {/* Ưu tiên */}
          <div>
            <label
              htmlFor="task-priority-select"
              className="block text-xs font-semibold text-ink"
            >
              Ưu tiên
            </label>
            <select
              id="task-priority-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="mt-1.5 block w-full rounded-xl border border-line bg-field px-3.5 py-2.5 text-sm text-ink transition focus:border-accent focus:outline-hidden"
            >
              <option value="LOW">Thấp</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HIGH">Cao</option>
            </select>
          </div>
        </div>

        {/* 4. Grid 2 cols: Ngày bắt đầu + Deadline */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Ngày bắt đầu */}
          <div>
            <label
              htmlFor="task-start-date"
              className="block text-xs font-semibold text-ink"
            >
              Ngày bắt đầu
            </label>
            <input
              id="task-start-date"
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                if (errors.startDate) {
                  setErrors((prev) => ({ ...prev, startDate: undefined }));
                }
              }}
              aria-invalid={Boolean(errors.startDate)}
              className={`mt-1.5 block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink transition focus:outline-hidden ${
                errors.startDate
                  ? 'border-danger focus:ring-1 focus:ring-danger'
                  : 'border-line focus:border-accent'
              }`}
            />
            {errors.startDate && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {errors.startDate}
              </p>
            )}
          </div>

          {/* Deadline */}
          <div>
            <label
              htmlFor="task-deadline-input"
              className="block text-xs font-semibold text-ink"
            >
              Deadline{' '}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="task-deadline-input"
              type="date"
              value={deadline}
              onChange={(e) => {
                setDeadline(e.target.value);
                if (errors.deadline) {
                  setErrors((prev) => ({ ...prev, deadline: undefined }));
                }
              }}
              aria-invalid={Boolean(errors.deadline)}
              className={`mt-1.5 block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink transition focus:outline-hidden ${
                errors.deadline
                  ? 'border-danger focus:ring-1 focus:ring-danger'
                  : 'border-line focus:border-accent'
              }`}
            />
            {errors.deadline && (
              <p role="alert" className="mt-1 text-xs text-danger">
                {errors.deadline}
              </p>
            )}
          </div>
        </div>

        {/* 5. Ước tính (Giờ) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="task-estimate-input"
              className="block text-xs font-semibold text-ink"
            >
              Ước tính{' '}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="task-estimate-input"
              type="number"
              step="0.5"
              min="0.5"
              value={estimatedHours}
              onChange={(e) => {
                setEstimatedHours(e.target.value);
                if (errors.estimatedHours) {
                  setErrors((prev) => ({ ...prev, estimatedHours: undefined }));
                }
              }}
              placeholder="Số giờ (vd: 3)"
              aria-invalid={Boolean(errors.estimatedHours)}
              aria-describedby={
                errors.estimatedHours ? 'task-estimate-error' : undefined
              }
              className={`mt-1.5 block w-full rounded-xl border bg-field px-3.5 py-2.5 text-sm text-ink transition focus:outline-hidden ${
                errors.estimatedHours
                  ? 'border-danger focus:ring-1 focus:ring-danger'
                  : 'border-line focus:border-accent'
              }`}
            />
            {errors.estimatedHours ? (
              <p
                id="task-estimate-error"
                className="mt-1.5 text-xs text-danger"
              >
                {errors.estimatedHours}
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                Ước tính bắt buộc lớn hơn 0 giờ.
              </p>
            )}
          </div>
        </div>
        {deadline && projectRange && ((projectRange.startDate && deadline < projectRange.startDate) || (projectRange.endDate && deadline > projectRange.endDate)) && <p role="status" className="rounded-xl bg-tint p-3 text-sm text-accent">Deadline nằm ngoài lịch dự kiến dự án. Bạn vẫn có thể lưu; cần xem xét lại kế hoạch.</p>}
        {/* 5. Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-line/60">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-xs transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
          >
            {isSubmitting && (
              <span
                className="size-4 animate-spin rounded-full border-2 border-current/40 border-t-current"
                aria-hidden="true"
              />
            )}
            {submitLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
