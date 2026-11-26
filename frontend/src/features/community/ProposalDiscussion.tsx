import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { UserAvatar } from '../profile/components/UserAvatar';
import { Icon } from '../../shared/ui/Icon';
import {
  communityRequest,
  communityQueryId,
  errorMessage,
  inputClass,
  useCommunityResource,
} from './community.api';
import type { Proposal } from './marketplace.api';

type Message = {
  id: number;
  sender_user_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};
type Discussion = {
  items: Message[];
  nextBefore: number | null;
  canSend: boolean;
  myReadId: number;
  otherReadId: number;
};

const messageTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function ProposalDiscussion({
  proposal,
  user,
  onChanged,
}: {
  proposal: Proposal;
  user: string;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(
    () =>
      communityQueryId('proposal') === String(proposal.id) &&
      new URLSearchParams(window.location.search).get('discussion') === '1',
  );
  return (
    <div className="border-t border-line pt-4">
      <Button
        kind="secondary"
        size="sm"
        aria-expanded={open}
        aria-controls={open ? 'proposal-discussion-' + proposal.id : undefined}
        onClick={() => setOpen((value) => !value)}
        className="rounded-full"
      >
        <Icon name="message" size={15} />
        {open ? 'Thu gọn trao đổi' : 'Trao đổi riêng'}
        <span className="rounded-full bg-panel px-2 py-0.5 text-[11px] tabular-nums text-muted">
          {proposal.message_count ?? 0}
        </span>
        {!!proposal.unread_messages && (
          <span aria-label={proposal.unread_messages + ' tin chưa đọc'} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-on-accent">
            {proposal.unread_messages} chưa đọc
          </span>
        )}
      </Button>
      {open && (
        <DiscussionThread
          proposal={proposal}
          user={user}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function DiscussionThread({
  proposal,
  user,
  onChanged,
}: {
  proposal: Proposal;
  user: string;
  onChanged: () => Promise<void>;
}) {
  const [before, setBefore] = useState<number | null>(null);
  const path = `community/requests/${proposal.request_id}/proposals/${proposal.id}/messages`;
  const resource = useCommunityResource<Discussion>(
    path + (before ? '?before=' + before : ''),
  );
  const [body, setBody] = useState('');
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [visible, setVisible] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const panel = useRef<HTMLElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const reading = useRef(0);
  const data = resource.data;
  const reload = resource.reload;

  useEffect(() => {
    let intersecting = false;
    const update = () =>
      setVisible(intersecting && document.visibilityState === 'visible');
    const observer = new IntersectionObserver((entries) => {
      intersecting = entries[0]?.isIntersecting ?? false;
      update();
    });
    if (panel.current) observer.observe(panel.current);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  useEffect(() => {
    if (before != null || !visible) return;
    const timer = window.setInterval(() => void reload(), 10000);
    return () => window.clearInterval(timer);
  }, [before, visible, reload]);
  useEffect(() => {
    if (before == null && atBottom && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [data, before, atBottom]);
  useEffect(() => {
    const last = data?.items.at(-1)?.id;
    if (
      !data ||
      !last ||
      !visible ||
      !atBottom ||
      before != null ||
      data.myReadId >= last ||
      reading.current
    )
      return;
    reading.current = last;
    void communityRequest(path + '/read', user, { messageId: last }, 'PUT')
      .then(async () => {
        setReadError('');
        await onChanged();
      })
      .catch((error) => setReadError(errorMessage(error)))
      .finally(() => {
        reading.current = 0;
      });
  }, [data, visible, atBottom, before, path, user, onChanged]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await communityRequest(path, user, { body, clientId }, 'POST');
      setBody('');
      setClientId(crypto.randomUUID());
      setBefore(null);
      setAtBottom(true);
      await resource.reload();
      await onChanged();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      ref={panel}
      aria-label={'Trao đổi với ' + proposal.team_name}
      id={'proposal-discussion-' + proposal.id}
      className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel/55 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-tint text-accent">
            <Icon name="message" size={18} />
          </span>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold tracking-tight">Trao đổi về đề xuất</h4>
            <p className="mt-0.5 truncate text-xs text-muted">Khách hàng <span aria-hidden="true">↔</span> {proposal.team_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-medium text-muted sm:inline-flex">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />Riêng tư
          </span>
          <Button kind="ghost" size="sm" icon="history" aria-label="Cập nhật trao đổi" title="Cập nhật trao đổi" onClick={() => void resource.reload()} className="size-9 !min-h-9 !p-0" />
        </div>
      </header>
      <div className="border-b border-line/70 px-4 py-2.5 sm:px-5">
        <p className="max-w-3xl text-[11px] leading-5 text-muted">Chỉ khách hàng đăng yêu cầu và chủ đội xem được. Trao đổi giúp làm rõ yêu cầu; chi phí và kế hoạch chính thức được cập nhật trong đề xuất.</p>
      </div>
      {resource.error ? (
        <div role="alert" className="m-4 rounded-xl border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
          {resource.error}
          <Button kind="ghost" size="sm" onClick={() => void resource.reload()}>
            Thử lại
          </Button>
        </div>
      ) : !data ? (
        <p role="status" className="m-4 rounded-xl bg-panel px-4 py-6 text-center text-sm text-muted">Đang tải trao đổi…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{data.items.length ? 'Lịch sử trao đổi' : 'Cuộc trò chuyện'}</p>
            <div className="flex flex-wrap gap-1">
            {data.nextBefore && (
              <Button
                kind="ghost"
                size="sm"
                onClick={() => {
                  setBefore(data.nextBefore);
                  setAtBottom(true);
                }}
              >
                Tin cũ hơn
              </Button>
            )}
            {before != null && (
              <Button
                kind="secondary"
                size="sm"
                onClick={() => {
                  setBefore(null);
                  setAtBottom(true);
                }}
              >
                Tin mới nhất
              </Button>
            )}
            </div>
          </div>
          <div
            ref={scroll}
            className="max-h-[min(24rem,55dvh)] space-y-3 overflow-y-auto bg-gradient-to-b from-panel/35 to-surface px-4 py-4 sm:px-5"
            onScroll={(event) => {
              const box = event.currentTarget;
              setAtBottom(
                box.scrollHeight - box.scrollTop - box.clientHeight < 24,
              );
            }}
          >
            {!data.items.length && (
              <div className="mx-auto grid max-w-sm justify-items-center gap-2 rounded-2xl border border-dashed border-line bg-surface/80 px-5 py-7 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-tint text-accent"><Icon name="message" size={19} /></span>
                <p className="text-sm font-semibold text-ink">Bắt đầu trao đổi</p>
                <p className="text-xs leading-5 text-muted">Hỏi về phạm vi, thời gian hoặc cách bàn giao trước khi chọn đội.</p>
              </div>
            )}
            {data.items.map((message) => (
              <div key={message.id} className={'flex items-end gap-2 ' + (message.sender_user_id === user ? 'justify-end' : 'justify-start')}>
                {message.sender_user_id !== user && <UserAvatar userId={message.sender_user_id} publicProfile name={message.sender_name} className="size-7 text-[9px]" />}
                <article className={'max-w-[88%] space-y-1 rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[78%] ' + (message.sender_user_id === user ? 'rounded-br-md bg-accent text-on-accent' : 'rounded-bl-md border border-line bg-surface text-ink')}>
                  <div className={'flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] ' + (message.sender_user_id === user ? 'text-on-accent/75' : 'text-muted')}>
                    <strong>{message.sender_user_id === user ? 'Bạn' : message.sender_name}</strong>
                    <time dateTime={message.created_at}>{messageTime.format(new Date(message.created_at))}</time>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                  {message.sender_user_id === user && <p className="flex items-center justify-end gap-1 text-[10px] font-medium text-on-accent/75"><Icon name="check" size={12} />{message.id <= data.otherReadId ? 'Đã đọc' : 'Đã gửi'}</p>}
                </article>
              </div>
            ))}
          </div>
          {before == null && !atBottom && (
            <Button kind="ghost" size="sm" onClick={() => setAtBottom(true)}>
              Xem tin nhắn mới nhất
            </Button>
          )}
          {readError && (
            <p role="status" className="mx-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning sm:mx-5">
              Chưa cập nhật trạng thái đã đọc: {readError}
            </p>
          )}
          {data.canSend ? (
            <form
              className="border-t border-line bg-surface p-3 sm:p-4"
              onSubmit={(event) => void send(event)}
              aria-busy={busy || undefined}
            >
              <label className="sr-only" htmlFor={'proposal-message-' + proposal.id}>
                Nội dung trao đổi
              </label>
              <div className="flex items-end gap-2 rounded-2xl border border-line bg-field p-1.5 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
                <textarea
                  id={'proposal-message-' + proposal.id}
                  className={inputClass + ' min-h-11 flex-1 resize-none border-0 bg-transparent shadow-none focus:border-transparent focus:ring-0'}
                  required
                  maxLength={2000}
                  rows={2}
                  disabled={busy}
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    setClientId(crypto.randomUUID());
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Bạn muốn làm rõ điều gì về đề xuất này?"
                />
                <Button type="submit" loading={busy} disabled={!body.trim()} aria-label="Gửi trao đổi" title="Gửi trao đổi" className="size-10 !min-h-10 !p-0">
                  {!busy && <Icon name="arrow" size={17} />}
                </Button>
              </div>
              <p className="mt-1.5 px-1 text-[10px] text-muted">Enter để gửi · Shift + Enter xuống dòng</p>
              {error && (
                <p role="alert" className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <p className="border-t border-line bg-panel/55 px-4 py-3 text-xs leading-5 text-muted sm:px-5">
              Cuộc trao đổi được lưu để đối chiếu. Yêu cầu hoặc đề xuất đã dừng
              trao đổi; sau khi chọn đội, tiếp tục công việc trong dự án.
            </p>
          )}
        </>
      )}
    </section>
  );
}
