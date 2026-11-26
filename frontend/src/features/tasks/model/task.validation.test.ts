import { describe, expect, it } from 'vitest';
import { validateCreateTask } from './task.validation';

describe('validateCreateTask', () => {
  it('returns valid when all fields are correct', () => {
    const result = validateCreateTask({
      title: 'Kiểm tra luồng xác nhận email',
      description:
        'Rà soát các trạng thái chờ, thành công và liên kết không hợp lệ.',
      assigneeId: 'user-an-linh',
      priority: 'MEDIUM',
      estimatedHours: 3,
      startDate: '2026-11-01',
      deadline: '2026-11-05',
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects empty title', () => {
    const result = validateCreateTask({
      title: '   ',
      description: '',
      assigneeId: 'user-an-linh',
      priority: 'MEDIUM',
      estimatedHours: 3,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBe('Tên nhiệm vụ không được để trống.');
  });

  it('rejects non-positive estimated hours', () => {
    const result = validateCreateTask({
      title: 'Thiết kế giao diện',
      description: '',
      assigneeId: 'user-an-linh',
      priority: 'LOW',
      estimatedHours: 0,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.estimatedHours).toBe(
      'Ước tính bắt buộc lớn hơn 0 giờ.',
    );
  });
});
