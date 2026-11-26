import { useEffect, useRef, useState } from 'react';
import {
  previewJoinLink,
  submitJoinRequest,
  type JoinLinkPreview,
} from '../api/invitation.api';
import { navigateTo } from '../../../app/router/location';
import { useWorkspace } from '../../workspace';
import { Button } from '../../../shared/ui/Button';
export function JoinProjectPage({
  code,
  userId,
}: {
  code: string;
  userId: string;
}) {
  const workspace = useWorkspace();
  const [link, setLink] = useState<JoinLinkPreview>();
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    previewJoinLink(userId, code)
      .then((value) => {
        if (active) {
          if (value.member) navigateTo(`/projects/${value.projectId}`);
          else setLink(value);
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Liên kết không còn hiệu lực.',
          );
      });
    return () => {
      active = false;
    };
  }, [code, userId]);
  return (
    <main className="relative isolate flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_50%_35%,color-mix(in_srgb,var(--color-accent)_14%,transparent),transparent_55%)]" />
      <section className="w-full max-w-xl space-y-6 rounded-3xl border border-line bg-surface p-7 shadow-xl sm:p-10">
        <button type="button" onClick={() => navigateTo('/dashboard')} className="text-sm text-muted transition hover:text-ink">← Quay lại</button>
        <div className="text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-tint text-xl font-bold text-accent">
            {link?.projectName?.slice(0, 2).toUpperCase() ?? 'TN'}
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-accent">Yêu cầu tham gia dự án</p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">
            {link?.projectName ?? 'Yêu cầu tham gia dự án'}
          </h1>
        </div>
      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}
      {!link && !error && (
        <p role="status" className="rounded-xl border border-line bg-field p-4 text-center text-sm text-muted">
          Đang kiểm tra liên kết…
        </p>
      )}
      {link &&
        (sent ? (
          <>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-center">
              <p role="status" className="text-sm font-semibold text-emerald-500">
              Yêu cầu đã được gửi. Bạn sẽ trở thành thành viên sau khi Owner
              hoặc Manager duyệt.
              </p>
            </div>
            <a
              href="/invitations"
              className="inline-block text-sm font-semibold text-accent"
            >
              Xem lời mời và yêu cầu →
            </a>
          </>
        ) : (
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy.current) return;
              busy.current = true;
              setPending(true);
              setError('');
              try {
                await submitJoinRequest(userId, code, reason);
                setSent(true);
                await workspace.refresh();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : 'Không thể gửi yêu cầu.',
                );
              } finally {
                busy.current = false;
                setPending(false);
              }
            }}
          >
            <p className="rounded-xl border border-line bg-field p-4 text-sm leading-6 text-muted">
              Người tạo liên kết: {link.creatorName}. Gửi yêu cầu để Owner hoặc
              Manager xét duyệt.
            </p>
            <label className="block text-sm font-semibold">
              Lý do muốn tham gia{' '}
              <span className="font-normal text-muted">(không bắt buộc)</span>
              <textarea
                disabled={pending}
                maxLength={500}
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 w-full resize-none rounded-xl border border-line bg-canvas p-3 font-normal text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <Button type="submit" loading={pending} className="w-full">
              {pending ? 'Đang gửi…' : 'Yêu cầu tham gia'}
            </Button>
          </form>
        ))}
      </section>
    </main>
  );
}
