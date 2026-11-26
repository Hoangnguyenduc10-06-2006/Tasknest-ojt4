import { ConfirmDialog, type Confirmation } from '../../../../shared/ui/ConfirmDialog';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../../../../shared/ui/Modal';
import {
  changeProjectShareLink,
  getProjectShareLink,
  projectJoinUrl,
} from '../../api/project-members.api';
import type { ProjectShareLink } from '../../model/project-member.types';
export function ShareProjectModal({
  open,
  userId,
  projectId,
  projectName,
  onClose,
}: {
  open: boolean;
  userId: string;
  projectId: string;
  projectName: string;
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [link, setLink] = useState<ProjectShareLink | null>();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    getProjectShareLink(userId, projectId)
      .then((value) => {
        if (active) {
          setLink(value);
          setError('');
          setCopied(false);
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'Không thể tải liên kết.',
          );
      });
    return () => {
      active = false;
    };
  }, [open, userId, projectId]);
  const url = link ? projectJoinUrl(window.location.origin, link.code) : '';
  const update = async (action: 'CREATE' | 'ROTATE' | 'DISABLE') => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      setLink(await changeProjectShareLink(userId, projectId, action));
      setCopied(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể cập nhật liên kết.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return (
    <>
    <Modal
      open={open}
      onClose={() => {
        if (!busy.current) onClose();
      }}
      title="Chia sẻ link / QR"
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-muted">
          Người mở link hoặc quét QR có thể gửi yêu cầu tham gia{' '}
          <strong className="text-ink">{projectName}</strong>. Owner hoặc
          Manager cần duyệt trước khi họ trở thành thành viên.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}
        {link ? (
          <>
            <div className="mx-auto w-fit rounded-2xl bg-white p-4">
              <QRCodeSVG
                value={url}
                size={200}
                level="M"
                marginSize={4}
                title={`Yêu cầu tham gia ${projectName}`}
              />
            </div>
            <label className="block text-sm font-semibold">
              Liên kết yêu cầu tham gia
              <input
                readOnly
                value={url}
                className="mt-2 w-full rounded-xl border border-line bg-field p-3 text-xs font-normal text-ink"
              />
            </label>
            <button
              disabled={pending}
              className="w-full rounded-xl bg-accent p-3 text-sm font-semibold text-on-accent disabled:opacity-50"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setError('');
                } catch {
                  setError(
                    'Không thể sao chép. Bạn có thể chọn và sao chép liên kết thủ công.',
                  );
                }
              }}
            >
              {copied ? 'Đã sao chép' : 'Sao chép liên kết'}
            </button>
            <p className="text-xs leading-5 text-muted">
              Tạo bởi {link.creatorName ?? link.createdBy}. Link/QR không tự hết
              hạn. Tắt hoặc tạo lại không hủy các yêu cầu đã gửi.
            </p>
            <div className="flex gap-3">
              <button
                disabled={pending}
                onClick={() => setConfirmation({ title: 'Tạo lại link / QR', description: 'Link và QR cũ sẽ bị vô hiệu hóa. Các yêu cầu đã gửi được giữ lại.', run: () => void update('ROTATE') })}
                className="flex-1 rounded-xl border border-line p-2 text-sm disabled:opacity-50"
              >
                Tạo lại link / QR
              </button>
              <button
                disabled={pending}
                onClick={() => setConfirmation({ title: 'Tắt liên kết', description: 'Người dùng sẽ không thể gửi yêu cầu mới qua link hoặc QR hiện tại. Các yêu cầu đã gửi được giữ lại.', run: () => void update('DISABLE') })}
                className="rounded-xl border border-line p-2 text-sm text-red-500 disabled:opacity-50"
              >
                Tắt liên kết
              </button>
            </div>
          </>
        ) : link === null ? (
          <div className="rounded-xl border border-dashed border-line p-6 text-center">
            <p className="mb-4 text-sm text-muted">
              Chưa có liên kết đang hoạt động.
            </p>
            <button
              disabled={pending}
              onClick={() => void update('CREATE')}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              {pending ? 'Đang tạo…' : 'Tạo link / QR'}
            </button>
          </div>
        ) : (
          !error && (
            <p role="status" className="text-sm text-muted">
              Đang tải liên kết…
            </p>
          )
        )}
      </div>
    </Modal>
    <ConfirmDialog confirmation={open ? confirmation : undefined} onClose={() => setConfirmation(undefined)} />
    </>
  );
}
