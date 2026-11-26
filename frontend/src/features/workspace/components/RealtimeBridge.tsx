import { useCallback } from 'react';
import { authenticatedAccessToken } from '../../auth';
import { useRealtime } from '../../../shared/realtime/useRealtime';

export function RealtimeBridge({ userId, showStatus }: { userId?: string; showStatus: boolean }) {
  const token = useCallback(() => authenticatedAccessToken(userId), [userId]);
  const connected = useRealtime(userId, token);
  if (!showStatus || connected) return null;

  return (
    <p role="status" className="mb-3 text-xs text-accent">
      Đang kết nối lại cập nhật trực tiếp. Thao tác lưu vẫn cần máy chủ xác nhận.
    </p>
  );
}
