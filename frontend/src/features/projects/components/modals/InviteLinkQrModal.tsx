import { useRef, useState } from 'react';
import { Modal } from '../../../../shared/ui/Modal';
import { useWorkspace } from '../../../workspace';
import {
  previewJoinLink,
  submitJoinRequest,
  type JoinLinkPreview,
} from '../../api/invitation.api';
export function InviteLinkQrModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const workspace = useWorkspace();
  const [input, setInput] = useState('');
  const [reason, setReason] = useState('');
  const [link, setLink] = useState<JoinLinkPreview>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const code =
    input.trim().split(/[?#]/)[0].replace(/\/$/, '').split('/').at(-1) ?? '';
  const act = async () => {
    if (!workspace.userId || busy.current) return;
    if (!/^[0-9a-f]{64}$/.test(code)) {
      setError('Liên kết hoặc mã tham gia không hợp lệ.');
      return;
    }
    busy.current = true;
    setSaving(true);
    setError(undefined);
    try {
      if (!link) {
        setLink(await previewJoinLink(workspace.userId, code));
      } else {
        await submitJoinRequest(workspace.userId, code, reason);
        await workspace.refresh();
        onClose();
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Không thể gửi yêu cầu.',
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy.current) onClose();
      }}
      title="Tham gia bằng liên kết"
      description="Dán liên kết Owner/Manager gửi hoặc liên kết nhận được khi quét QR."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void act();
        }}
      >
        <fieldset disabled={saving} className="space-y-4">
          <label className="block text-sm">
            Liên kết hoặc mã tham gia
            <input
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setLink(undefined);
                setError(undefined);
              }}
              className="mt-2 w-full rounded-xl border border-line bg-field p-3 text-sm"
              required
            />
          </label>
          {link && (
            <div className="rounded-xl bg-panel p-4">
              <strong>{link.projectName}</strong>
              <p className="mt-2 text-sm text-muted">
                {link.member
                  ? 'Bạn đã là thành viên dự án này.'
                  : 'Yêu cầu sẽ chờ Owner hoặc Manager duyệt.'}
              </p>
              {link.member && (
                <a href={`/projects/${link.projectId}`} className="text-accent">
                  Mở dự án →
                </a>
              )}
            </div>
          )}
          {link && !link.member && (
            <label className="block text-sm">
              Lý do tham gia (không bắt buộc)
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                className="mt-2 w-full rounded-xl border border-line bg-field p-3 text-sm"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {!link?.member && (
            <button className="rounded-xl bg-accent px-4 py-2 text-sm text-on-accent">
              {saving
                ? 'Đang xử lý...'
                : link
                  ? 'Gửi yêu cầu tham gia'
                  : 'Kiểm tra liên kết'}
            </button>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
