import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../auth';
import { areaHref } from '../../app/router/location';
import { ConnectionActions } from '../community/ConnectionsPage';
import { ConversationAvatar } from './ConversationAvatar';
import { Icon } from '../../shared/ui/Icon';
import { communityRequest } from '../community/community.api';
import { ChatComposer } from './ChatComposer';
import { ChatMessageImages } from './ChatMessageImages';
import { ChatInboxTime, ChatTimeline } from './ChatTimeline';
import { ChatReceiptStatus } from './ChatReceiptStatus';
import { setChatReplyTarget } from './chat-drafts';
import {
  chatMessagePreview,
  chatImageCount,
  reactToChatMessage,
  kindLabel,
  useChatResource,
  type ChatHistory,
  type ChatList,
  type Conversation,
} from './messaging.api';

const launcherClass = 'fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-5 z-30 grid size-14 place-items-center rounded-full border-2 border-surface bg-accent text-on-accent shadow-[0_12px_30px_rgba(37,99,235,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_16px_36px_rgba(37,99,235,0.34)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent';
const headerActionClass = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-2.5 text-xs font-semibold text-accent transition hover:bg-tint focus-visible:outline-2 focus-visible:outline-accent';

export function ChatLauncher({
  guest = false,
  unreadCount = 0,
}: {
  guest?: boolean;
  unreadCount?: number;
}) {
  const session = useSession();
  if (session.status === 'authenticated' && session.user.emailVerified) {
    return <SignedInLauncher key={session.user.id} user={session.user.id} unreadCount={unreadCount} />;
  }
  return guest ? (
    <a
      href={'/login?returnTo=' + encodeURIComponent(areaHref('/messages'))}
      aria-label="Đăng nhập để nhắn tin"
      title="Đăng nhập để nhắn tin"
      className={launcherClass}
    >
      <Icon name="message" size={23} />
    </a>
  ) : null;
}
function SignedInLauncher({ user, unreadCount }: { user: string; unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const [room, setRoom] = useState<Conversation>();
  const launcher = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const inbox = useChatResource<ChatList>(open && !room ? '?page=0' : null, user, 15000);
  const fullHref = areaHref(room ? '/messages?conversation=' + room.id : '/messages');
  const now = new Date();

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open, room?.id]);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  return (
    <>
      <button
        ref={launcher}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? 'Thu gọn tin nhắn' : unreadCount ? 'Tin nhắn · ' + unreadCount + ' chưa đọc' : 'Tin nhắn'}
        aria-expanded={open}
        aria-controls={open ? 'quick-chat' : undefined}
        title={open ? 'Thu gọn tin nhắn' : 'Tin nhắn'}
        className={launcherClass}
      >
        <Icon name={open ? 'close' : 'message'} size={23} />
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-surface bg-danger px-1 text-center text-[10px] font-bold leading-5 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          id="quick-chat"
          role="dialog"
          aria-modal="false"
          aria-labelledby="quick-chat-title"
          onKeyDown={(event) => {
            if (
              event.key === 'Escape' &&
              !event.defaultPrevented &&
              !document.querySelector('dialog[open]')
            ) {
              event.stopPropagation();
              close();
            }
          }}
          className="motion-sheet fixed inset-x-0 bottom-0 z-[35] flex h-[min(88dvh,44rem)] w-full min-w-0 flex-col overflow-hidden rounded-t-[1.5rem] border border-line/80 bg-surface/95 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur sm:inset-x-auto sm:bottom-[8.5rem] sm:right-5 sm:h-[min(33rem,calc(100dvh-9.5rem))] sm:w-[min(25rem,calc(100vw-2.5rem))] sm:rounded-[1.4rem]"
        >
          <header className="flex shrink-0 items-center gap-2 border-b border-line/80 bg-gradient-to-br from-surface via-surface to-tint/40 px-3.5 py-3 shadow-sm backdrop-blur">
            {room && (
              <button
                type="button"
                title="Danh sách cuộc trò chuyện"
                aria-label="Danh sách cuộc trò chuyện"
                className={headerActionClass}
                onClick={() => setRoom(undefined)}
              >
                <span className="rotate-180"><Icon name="arrow" size={17} /></span>
              </button>
            )}
            {room && <ConversationAvatar room={room} className="size-9 text-xs" />}
            <div className="min-w-0 flex-1">
              <h2 id="quick-chat-title" ref={heading} tabIndex={-1} className="truncate text-sm font-semibold focus:outline-none">
                {room?.title ?? 'Tin nhắn'}
              </h2>
              <p className="truncate text-xs text-muted">
                {room ? kindLabel[room.kind] : 'Cuộc trò chuyện gần đây'}
              </p>
            </div>
            <a href={fullHref} aria-label="Mở toàn trang" className={headerActionClass + ' gap-1'} onClick={(event) => {
              if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setOpen(false);
            }}>
              <span className="hidden sm:inline">Mở toàn trang</span><Icon name="arrow" size={15} />
            </a>
            <button type="button" onClick={close} aria-label="Thu gọn cửa sổ tin nhắn" title="Thu gọn" className={headerActionClass}>
              <Icon name="close" size={17} />
            </button>
          </header>
          {room ? <QuickThread key={room.id} room={room} user={user} /> : (
            <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-panel/30 to-surface p-2.5" aria-label="Cuộc trò chuyện gần đây">
              {inbox.error && (
                <div className="space-y-2 p-3 text-sm">
                  <p role="alert" className="text-danger">{inbox.error}</p>
                  <button type="button" className={headerActionClass} onClick={() => void inbox.reload()}>Thử lại</button>
                </div>
              )}
              {!inbox.data && !inbox.error && <p role="status" className="p-3 text-sm text-muted">Đang tải cuộc trò chuyện…</p>}
              {inbox.data?.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="group flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl border border-transparent p-3 text-left transition hover:border-line hover:bg-surface hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent"
                  onClick={() => setRoom(item)}
                >
                  <ConversationAvatar room={item} linked={false} className="size-10 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <strong className="truncate text-sm">{item.title}</strong>
                      <ChatInboxTime value={item.lastMessage?.created_at} now={now} />
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted">
                      {item.lastMessage ? (item.lastMessage.sender_user_id === user ? 'Bạn: ' : '') + chatMessagePreview(item.lastMessage) : kindLabel[item.kind]}
                    </span>
                  </span>
                  {item.unread > 0 && (
                    <span aria-label={item.unread + ' tin chưa đọc'} className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-on-accent shadow-sm">
                      {item.unread}
                    </span>
                  )}
                </button>
              ))}
              {inbox.data && !inbox.data.items.length && (
                <div className="m-2 rounded-2xl border border-dashed border-line bg-surface/70 p-5 text-center">
                  <span className="mx-auto mb-2 grid size-10 place-items-center rounded-2xl bg-tint text-accent"><Icon name="message" size={19} /></span>
                  <p className="text-sm font-semibold text-ink">Chưa có cuộc trò chuyện</p>
                  <p className="mt-1 text-xs leading-5 text-muted">Mở trang Tin nhắn để trao đổi với thành viên, đội hoặc dự án.</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function QuickThread({ room, user }: { room: Conversation; user: string }) {
  const resource = useChatResource<ChatHistory>('/' + room.id, user, 8000);
  const data = resource.data;
  const unreadAfterId = resource.initialData?.myReadId ?? data?.myReadId;
  const scroll = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const lastRead = useRef(0);
  const [visible, setVisible] = useState(!document.hidden);
  const latest = data?.items.at(-1)?.id;

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const markRead = useCallback(() => {
    if (!latest || resource.error || document.hidden || !stick.current || latest <= Math.max(data?.myReadId ?? 0, lastRead.current)) return;
    lastRead.current = latest;
    void communityRequest('community/chat/' + room.id + '/read', user, { messageId: latest }, 'PUT')
      .then(() => window.dispatchEvent(new Event('tasknest:chat-read')))
      .catch(() => { if (lastRead.current === latest) lastRead.current = 0; });
  }, [latest, resource.error, data?.myReadId, room.id, user]);

  useEffect(() => {
    if (stick.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [data, latest]);
  useEffect(() => {
    if (visible) markRead();
  }, [data, visible, markRead]);

  return (
    <>
      <div
        ref={scroll}
        onScroll={(event) => {
          const box = event.currentTarget;
          stick.current = box.scrollHeight - box.scrollTop - box.clientHeight < 24;
          markRead();
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-gradient-to-b from-panel/50 via-surface to-tint/20 p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]"
        aria-label="Lịch sử tin nhắn"
      >
        {resource.error && (
          <div className="space-y-2 text-sm">
            <p role="alert" className="text-danger">{resource.error}</p>
            <button type="button" className={headerActionClass} onClick={() => void resource.reload()}>Thử lại</button>
          </div>
        )}
        {!data && !resource.error && <p role="status" className="text-sm text-muted">Đang tải tin nhắn…</p>}
        {data && data.items.length === 0 && <p className="p-4 text-center text-sm text-muted">Chưa có tin nhắn.</p>}
        {data && (
          <ChatTimeline messages={data.items} conversationId={room.id} userId={user} unreadAfterId={unreadAfterId ?? data.myReadId} onReply={data.canSend && !resource.error ? (message) => setChatReplyTarget(user, room.id, message) : undefined} onReaction={!data.readOnly && !resource.error ? async (messageId, emoji, remove) => {
            await reactToChatMessage(room.id, messageId, user, emoji, remove);
            await resource.reload();
          } : undefined} renderReceipt={(message) => <ChatReceiptStatus messageId={message.id} user={user} participants={data.participants} compact />} renderMessage={(message, own) => (
            <article className={'w-fit max-w-[88%] space-y-1 rounded-[1.15rem] px-3.5 py-2.5 text-sm leading-5 shadow-sm transition ' + (own ? 'rounded-br-md bg-accent text-on-accent shadow-accent/15' : 'rounded-bl-md border border-line/80 bg-surface text-ink shadow-black/5')}>
              {!own && data.kind !== 'DIRECT' && <p className="break-words text-xs font-semibold text-muted">{message.sender_name}</p>}
              {message.body && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{message.body}</p>}
              <ChatMessageImages compact conversationId={room.id} messageId={message.id} userId={user} count={chatImageCount(message)} />
            </article>
          )} />
        )}
      </div>
      {data?.kind === 'DIRECT' && data.peerId && !data.myBlocked && !resource.error && (
        <ConnectionActions key={data.peerId} userId={data.peerId} inChat chatState={data.connectionState} onChanged={resource.reload} />
      )}
      {typeof data?.remainingBeforeFriendship === 'number' && data.canSend && !resource.error && (
        <p className="px-3 pt-2 text-xs text-muted">Còn {data.remainingBeforeFriendship}/3 tin nhắn trước khi kết bạn.</p>
      )}
      {data?.canSend && !resource.error ? (
        <ChatComposer
          compact
          conversationId={room.id}
          userId={user}
          onSent={async () => {
            stick.current = true;
            await resource.reload();
          }}
        />
      ) : data && (
        <p className="border-t border-line/80 bg-panel/30 p-3.5 text-xs text-muted">
          {data.remainingBeforeFriendship === 0 && !resource.error && !data.myBlocked ? (
            <>Đã gửi đủ 3 tin nhắn. <a href={'/members/' + data.peerId} className="font-semibold text-accent underline">Mở hồ sơ để kết bạn</a>.</>
          ) : 'Cuộc trò chuyện này đang chỉ đọc.'}
        </p>
      )}
    </>
  );
}
