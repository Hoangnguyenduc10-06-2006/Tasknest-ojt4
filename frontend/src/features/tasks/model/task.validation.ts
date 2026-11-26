import type { CreateTaskInput, TaskFormErrors } from './task.types';

export function validateCreateTask(input: CreateTaskInput): {
  isValid: boolean;
  errors: TaskFormErrors;
} {
  const errors: TaskFormErrors = {};

  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) {
    errors.title = 'Tên nhiệm vụ không được để trống.';
  } else if (trimmedTitle.length < 3) {
    errors.title = 'Tên nhiệm vụ phải có ít nhất 3 ký tự.';
  } else if (trimmedTitle.length > 100) {
    errors.title = 'Tên nhiệm vụ không được vượt quá 100 ký tự.';
  }

  if (!input.assigneeId) {
    errors.assigneeId = 'Vui lòng chọn người phụ trách.';
  }

  if (
    typeof input.estimatedHours !== 'number' ||
    !Number.isFinite(input.estimatedHours) ||
    input.estimatedHours <= 0
  ) {
    errors.estimatedHours = 'Ước tính bắt buộc lớn hơn 0 giờ.';
  }

  if (!input.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate))
    errors.startDate = 'Vui lòng chọn ngày bắt đầu.';
  if (!input.deadline) errors.deadline = 'Vui lòng chọn deadline.';
  else if (input.startDate && input.deadline < input.startDate)
    errors.deadline = 'Deadline không được trước ngày bắt đầu.';
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(input.priority))
    errors.priority = 'Ưu tiên không hợp lệ.';
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
