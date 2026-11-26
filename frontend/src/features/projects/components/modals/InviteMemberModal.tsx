import { useRef, useState } from 'react';
import { Modal } from '../../../../shared/ui/Modal';
export interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string) => Promise<void>;
}
export function InviteMemberModal({
  open,
  onClose,
  onInvite,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy.current) onClose();
      }}
      title="Mời thành viên mới"
      description="Mời tài khoản đã đăng ký và xác nhận email tham gia dự án."
    >
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy.current) return;
          busy.current = true;
          setPending(true);
          setError('');
          try {
            await onInvite(email);
            setEmail('');
            onClose();
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : 'Không thể gửi lời mời. Vui lòng thử lại.',
            );
          } finally {
            busy.current = false;
            setPending(false);
          }
        }}
      >
        <label className="block space-y-2 text-sm font-semibold text-ink">
          Email người nhận
          <input
            type="email"
            required
            maxLength={255}
            autoComplete="email"
            disabled={pending}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ban@example.com"
            className="w-full rounded-xl border border-line bg-field px-4 py-3 font-normal text-ink focus-visible:outline-accent"
          />
        </label>
        <p className="rounded-xl bg-tint p-3 text-sm leading-6 text-muted">
          Người nhận sẽ nhận lời mời trong ứng dụng và qua email. Khi chấp nhận,
          họ tham gia với vai trò Thành viên, không cần duyệt thêm. Lời mời có
          hiệu lực 7 ngày.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-xl border border-line px-4 py-2 text-sm disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            disabled={pending}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            {pending ? 'Đang gửi…' : 'Gửi lời mời'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
