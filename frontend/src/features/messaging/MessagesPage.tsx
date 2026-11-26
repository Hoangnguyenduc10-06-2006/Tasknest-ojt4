import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react';
import type { SessionUser } from '../auth';
import {
  areaHref,
  subscribeToLocation,
  navigateTo,
  replaceTo,
} from '../../app/router/location';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import { TextField } from '../../shared/ui/TextField';
import { PageHeader } from '../../shared/ui/PageHeader';
import { Avatar } from '../../shared/ui/Avatar';
import { ConnectionActions } from '../community/ConnectionsPage';
import { UserAvatar } from '../profile/components/UserAvatar';
import { ConversationAvatar } from './ConversationAvatar';
import { Icon } from '../../shared/ui/Icon';
import {
  communityRequest,
  errorMessage,
  inputClass,
} from '../community/community.api';
import {
  chatLaunch,
  chatImageCount,
  chatMessagePreview,
  reactToChatMessage,
  chatSearchPath,
  chatQuery,
  filterConversations,
  kindLabel,
  useChatResource,
  type ChatHistory,
  type ChatList,
  type ChatMessage,
  type ChatSpaces,
  type ChatKind,
} from './messaging.api';
import { ChatComposer } from './ChatComposer';
import { ChatMessageImages } from './ChatMessageImages';
import { ChatInboxTime, ChatTimeline } from './ChatTimeline';
import { ChatReceiptStatus } from './ChatReceiptStatus';
import { setChatReplyTarget, useChatComposerState } from './chat-drafts';
import {
  deriveTaskDraftFromMessage,
  extractTaskReferences,
  togglePinChatMessage,
  usePinnedChatMessages,
} from './chat-enhancements';
const path = (id: number) => areaHref('/messages?conversation=' + id);

export function MessagesPage({ user }: { user: SessionUser }) {
  const search = useSyncExternalStore(
    subscribeToLocation,
    () => window.location.search,
  );
  const selected = chatQuery(search);
  const [page, setPage] = useState(0);
  const inbox = useChatResource<ChatList>('?page=' + page, user.id);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [conversationFilter, setConversationFilter] = useState('');
  const reloadInbox = inbox.reload;
  useEffect(() => {
    const launch = chatLaunch(search);
    if (!launch) return;
    let active = true;
    void communityRequest<number>('community/chat', user.id, launch, 'POST')
      .then((id) => {
        if (active) {
          replaceTo(path(id));
          void reloadInbox();
        }
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [search, user.id, reloadInbox]);
  const conversations = filterConversations(
    inbox.data?.items ?? [],
    conversationFilter,
  );
  const now = new Date();
  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-8">
      <PageHeader
        eyebrow="KẾT NỐI & PHỐI HỢP"
        title="Tin nhắn"
        description="Trao đổi với đội ngũ, thành viên và khách hàng ngay trong không gian làm việc."
        actions={
          <Button icon="plus" className="shadow-md shadow-accent/15" onClick={() => setCreating(true)}>
            Tạo cuộc trò chuyện
          </Button>
        }
      />
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-danger/20 bg-danger-soft/60 px-4 py-3 text-sm text-danger">
          <Icon name="alert" size={17} />
          <p>{error}</p>
        </div>
      )}
      <div className="grid min-h-[min(760px,calc(100dvh-14rem))] min-w-0 overflow-hidden rounded-[1.75rem] border border-line/80 bg-surface shadow-xl shadow-ink/5 md:h-[clamp(520px,calc(100dvh-14rem),760px)] md:min-h-0 md:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          aria-label="Danh sách cuộc trò chuyện"
          className={
            'flex min-h-0 min-w-0 flex-col border-line bg-panel/40 md:border-r ' +
            (selected ? 'hidden md:flex' : '')
          }
        >
          <div className="shrink-0 border-b border-line/80 bg-surface/90 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent shadow-md shadow-accent/20">
                  <Icon name="message" size={19} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold tracking-tight">Hộp thư</h2>
                  <p className="mt-0.5 text-xs text-muted">{inbox.data?.items.length ?? 0} cuộc trò chuyện</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/15 bg-tint px-2.5 py-1.5 text-[11px] font-semibold text-accent">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                {inbox.data?.unreadCount ?? 0} chưa đọc
              </span>
            </div>
            <label className="sr-only" htmlFor="conversation-filter">
              Tìm trong danh sách cuộc trò chuyện
            </label>
            <div className="relative mt-4">
              <input
                id="conversation-filter"
                type="search"
                value={conversationFilter}
                onChange={(event) => setConversationFilter(event.target.value)}
                placeholder="Tìm người hoặc nội dung…"
                className={inputClass + ' rounded-xl border-line bg-field/80 py-2.5 pl-10 shadow-inner shadow-ink/[0.02] focus:bg-surface'}
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                <Icon name="search" size={16} />
              </span>
            </div>
          </div>
          {inbox.error && (
            <div role="alert" className="m-3 rounded-2xl border border-danger/20 bg-danger-soft/50 p-3 text-sm text-danger">
              <p>{inbox.error}</p>
              <Button kind="ghost" size="sm" className="mt-2 !text-danger" onClick={() => void inbox.reload()}>
                Thử tải lại
              </Button>
            </div>
          )}
          {!inbox.data && !inbox.error && (
            <div role="status" className="space-y-3 p-4">
              {[0, 1, 2].map((item) => <div key={item} className="flex animate-pulse items-center gap-3 rounded-2xl p-3 motion-reduce:animate-none"><span className="size-10 rounded-full bg-line/70" /><span className="flex-1 space-y-2"><span className="block h-3 w-2/3 rounded-full bg-line/70" /><span className="block h-2.5 w-full rounded-full bg-line/50" /></span></div>)}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
            {conversations.map((room) => (
              <a
                key={room.id}
                href={path(room.id)}
                onClick={(event) => {
                  if (
                    event.button === 0 &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    navigateTo(path(room.id));
                  }
                }}
                aria-current={selected === room.id ? 'page' : undefined}
                className={
                  'group relative mb-1.5 flex items-center gap-3 rounded-2xl border border-transparent p-3 transition duration-150 hover:border-line/80 hover:bg-surface hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent ' +
                  (selected === room.id ? 'border-accent/20 bg-surface shadow-sm shadow-accent/5 before:absolute before:bottom-3 before:left-0 before:top-3 before:w-1 before:rounded-full before:bg-accent' : '')
                }
              >
                <span className="relative shrink-0">
                  <ConversationAvatar room={room} linked={false} className="size-11 text-xs ring-2 ring-surface" />
                  {room.unread > 0 && <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface bg-accent" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <strong className={'truncate text-sm ' + (room.unread ? 'font-bold text-ink' : 'font-semibold text-ink/90')}>{room.title}</strong>
                    <ChatInboxTime value={room.lastMessage?.created_at} now={now} />
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                      {kindLabel[room.kind]}
                    </span>
                    {room.unread > 0 && (
                      <span
                        aria-label={room.unread + ' tin chưa đọc'}
                        className="grid min-h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-on-accent shadow-sm shadow-accent/15"
                      >
                        {room.unread > 9 ? '9+' : room.unread}
                      </span>
                    )}
                  </span>
                  <span className={'mt-1 block truncate text-xs ' + (room.unread ? 'font-medium text-ink/80' : 'text-muted')}>
                    {room.lastMessage
                      ? (room.lastMessage.sender_user_id === user.id
                          ? 'Bạn: '
                          : room.lastMessage.sender_name + ': ') +
                        chatMessagePreview(room.lastMessage)
                      : 'Bắt đầu cuộc trò chuyện'}
                  </span>
                </span>
              </a>
            ))}
            {inbox.data && !inbox.data.items.length && (
              <div className="m-2 rounded-2xl border border-dashed border-line bg-surface/60 px-5 py-8 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-tint text-accent"><Icon name="message" size={20} /></span>
                <p className="mt-3 text-sm font-semibold text-ink">Hộp thư đang trống</p>
                <p className="mt-1 text-xs leading-5 text-muted">Tạo cuộc trò chuyện với thành viên, đội hoặc khách hàng.</p>
                <Button size="sm" kind="secondary" className="mt-4" icon="plus" onClick={() => setCreating(true)}>Bắt đầu</Button>
              </div>
            )}
            {inbox.data?.items.length && !conversations.length ? (
              <div className="m-2 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-sm text-muted">
                <Icon name="search" size={20} />
                <p className="mt-2">Không tìm thấy cuộc trò chuyện phù hợp.</p>
              </div>
            ) : null}
          </div>
          {(page > 0 || inbox.data?.hasMore) && (
            <div className="flex justify-between p-3">
              <Button
                kind="ghost"
                size="sm"
                disabled={!page}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <Button
                kind="ghost"
                size="sm"
                disabled={!inbox.data?.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Tiếp
              </Button>
            </div>
          )}
        </aside>
        {selected ? (
          <Thread
            key={user.id + '/' + selected}
            id={selected}
            user={user.id}
            onChanged={inbox.reload}
          />
        ) : (
          <div className="relative hidden min-h-0 items-center justify-center overflow-hidden bg-gradient-to-br from-surface via-surface to-tint/70 p-8 text-center md:flex">
            <span aria-hidden="true" className="absolute -right-16 -top-20 size-72 rounded-full bg-accent/5 blur-3xl" />
            <span aria-hidden="true" className="absolute -bottom-24 -left-12 size-64 rounded-full bg-review/10 blur-3xl" />
            <div className="relative max-w-md">
              <span className="mx-auto grid size-20 place-items-center rounded-[1.75rem] border border-accent/15 bg-surface text-accent shadow-lg shadow-accent/10">
                <Icon name="message" size={34} />
              </span>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-accent">TaskNest Chat</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Công việc bắt đầu từ một cuộc trò chuyện
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">
                Trao đổi với thành viên, phối hợp cùng đội ngũ và thống nhất
                công việc với khách hàng ngay trong TaskNest.
              </p>
              <Button className="mt-6" icon="plus" onClick={() => setCreating(true)}>
                Bắt đầu trò chuyện
              </Button>
            </div>
          </div>
        )}
      </div>
      {creating && (
        <NewConversation
          user={user.id}
          onClose={() => setCreating(false)}
          onOpen={(id) => {
            setCreating(false);
            setPage(0);
            navigateTo(path(id));
            void reloadInbox();
          }}
        />
      )}
    </div>
  );
}
function NewConversation({
  user,
  onClose,
  onOpen,
}: {
  user: string;
  onClose: () => void;
  onOpen: (id: number) => void;
}) {
  const spaces = useChatResource<ChatSpaces>('/spaces', user, 60000);
  const [search, setSearch] = useState('');
  const [people, setPeople] = useState<
    { id: string; fullName: string }[] | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const searchSequence = useRef(0);
  async function find(event: FormEvent) {
    event.preventDefault();
    const revision = ++searchSequence.current;
    setSearching(true);
    setError('');
    try {
      const results = await communityRequest<
        { id: string; fullName: string }[]
      >(
        'community/chat/people?search=' + encodeURIComponent(search.trim()),
        user,
      );
      if (searchSequence.current === revision) setPeople(results);
    } catch (error) {
      if (searchSequence.current === revision) setError(errorMessage(error));
    } finally {
      if (searchSequence.current === revision) setSearching(false);
    }
  }
  async function open(kind: ChatKind, target: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onOpen(
        await communityRequest<number>(
          'community/chat',
          user,
          { kind, target },
          'POST',
        ),
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title="Cuộc trò chuyện mới"
      description="Tìm tài khoản trong TaskNest hoặc mở phòng thuộc đội và dự án bạn tham gia."
      maxWidth="xl"
    >
      <form
        onSubmit={(event) => void find(event)}
        className="flex items-end gap-2 rounded-2xl border border-line bg-panel/45 p-3"
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="Tìm thành viên"
            value={search}
            minLength={2}
            maxLength={100}
            placeholder="Tên hoặc email tài khoản"
            onChange={(event) => {
              searchSequence.current++;
              setSearch(event.target.value);
              setPeople(null);
              setSearching(false);
            }}
          />
        </div>
        <Button
          type="submit"
          loading={searching}
          disabled={busy || search.trim().length < 2}
        >
          Tìm kiếm
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {people && (
        <div className="mt-4 space-y-2">
          {people.length ? (
            people.map((person) => (
              <button
                disabled={busy}
                key={person.id}
                onClick={() => void open('DIRECT', person.id)}
          className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left text-sm shadow-sm shadow-ink/[0.02] transition hover:border-accent/25 hover:bg-tint disabled:opacity-50"
              >
                <UserAvatar userId={person.id} name={person.fullName} publicProfile className="size-10 text-xs" />
                <span className="min-w-0 flex-1 truncate font-semibold">{person.fullName}</span>
                <span className="text-xs font-semibold text-accent transition group-hover:translate-x-0.5">
                  Nhắn tin →
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted">
              Không tìm thấy tài khoản phù hợp.
            </p>
          )}
        </div>
      )}
      {spaces.error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {spaces.error}
        </p>
      )}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {(['teams', 'projects'] as const).map((kind) => (
          <section key={kind}>
            <h3 className="mb-2 text-sm font-semibold">
              {kind === 'teams' ? 'Đội của bạn' : 'Dự án của bạn'}
            </h3>
            <div className="max-h-60 space-y-2 overflow-y-auto rounded-2xl border border-line bg-panel/35 p-2">
              {spaces.data?.[kind].map((space) => (
                <button
                  disabled={busy}
                  key={space.id}
                  onClick={() =>
                    void open(
                      kind === 'teams' ? 'TEAM' : 'PROJECT',
                      String(space.id),
                    )
                  }
                  className="group flex w-full items-center gap-3 break-words rounded-xl border border-transparent bg-surface p-3 text-left text-sm shadow-sm shadow-ink/[0.02] transition hover:border-accent/20 hover:bg-tint disabled:opacity-50"
                >
                  <Avatar name={space.name} tone={kind === 'projects' ? 'purple' : 'neutral'} className="size-9 shrink-0 text-[10px]" />
                  <span className="min-w-0 flex-1 truncate font-medium">{space.name}</span>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
              {spaces.data && !spaces.data[kind].length && (
                <p className="text-xs text-muted">
                  Chưa có {kind === 'teams' ? 'đội' : 'dự án'} phù hợp.
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
function Thread({
  id,
  user,
  onChanged,
}: {
  id: number;
  user: string;
  onChanged: () => Promise<void>;
}) {
  const [before, setBefore] = useState<number | null>(null);
  const [around, setAround] = useState<number | null>(null);
  const resource = useChatResource<ChatHistory>(
    '/' + id + (around ? '?around=' + around : before ? '?before=' + before : ''),
    user,
    8000,
  );
  const data = resource.data;
  const unreadAfterId = resource.initialData?.myReadId ?? data?.myReadId;
  const { sending } = useChatComposerState(user, id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const [visible, setVisible] = useState(!document.hidden);
  const [participants, setParticipants] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [highlightMessageId, setHighlightMessageId] = useState<number>();
  const [taskDraftMessage, setTaskDraftMessage] = useState<ChatMessage | null>(null);
  const pinnedMessages = usePinnedChatMessages(id);
  const search = useChatResource<ChatMessage[]>(
    searchOpen && debouncedSearch.length >= 2
      ? chatSearchPath(id, debouncedSearch)
      : null,
    user,
    60000,
  );
  const scroll = useRef<HTMLDivElement>(null);
  const reading = useRef(0);
  const lastRead = useRef(0);
  useEffect(() => {
    const change = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (atBottom && scroll.current)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [data, atBottom]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);
  useEffect(() => {
    if (!highlightMessageId || !data?.items.some((message) => message.id === highlightMessageId)) return;
    scroll.current?.querySelector('#chat-message-' + highlightMessageId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [data, highlightMessageId]);
  useEffect(() => {
    const latest = data?.items.at(-1)?.id;
    if (
      !latest ||
      !visible ||
      !atBottom ||
      before ||
      around ||
      reading.current ||
      latest <= Math.max(data?.myReadId ?? 0, lastRead.current)
    )
      return;
    reading.current = latest;
    void communityRequest(
      'community/chat/' + id + '/read',
      user,
      { messageId: latest },
      'PUT',
    )
      .then(async () => {
        lastRead.current = latest;
        window.dispatchEvent(new Event('tasknest:chat-read'));
        setReadError('');
        await onChanged();
      })
      .catch((error) => setReadError(errorMessage(error)))
      .finally(() => {
        reading.current = 0;
      });
  }, [data, visible, atBottom, before, around, id, user, onChanged]);
  async function block() {
    if (!data || busy || sending) return;
    setBusy(true);
    setError('');
    try {
      await communityRequest(
        'community/chat/' + id + '/block',
        user,
        { blocked: !data.myBlocked },
        'PUT',
      );
      await resource.reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Nội dung cuộc trò chuyện"
      className="flex min-h-[520px] min-w-0 flex-col bg-surface md:h-full md:min-h-0"
    >
      <header className="z-[1] shrink-0 border-b border-line/80 bg-surface/95 px-3 py-3 shadow-sm shadow-ink/[0.02] backdrop-blur sm:px-5 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <a
              href={areaHref("/messages")}
              onClick={(event) => {
                event.preventDefault();
                navigateTo('/messages');
              }}
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-panel text-accent transition hover:border-accent/25 hover:bg-tint focus-visible:outline-2 focus-visible:outline-accent md:hidden"
              aria-label="Về danh sách tin nhắn"
              title="Về danh sách"
            >
              <Icon name="arrow" size={17} />
            </a>
            <ConversationAvatar room={data} className="size-10 text-xs sm:size-11" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold tracking-tight sm:text-base">
                {data?.title ?? 'Cuộc trò chuyện'}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted sm:text-xs">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                {data ? kindLabel[data.kind] : 'Đang tải cuộc trò chuyện…'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button kind={searchOpen ? 'secondary' : 'ghost'} size="sm" icon="search" aria-label="Tìm trong cuộc trò chuyện" title="Tìm tin nhắn" onClick={() => setSearchOpen((open) => !open)} className="!size-9 !min-h-9 !px-0 sm:!size-auto sm:!min-h-9 sm:!px-3" />
            <Button kind="ghost" size="sm" icon="history" aria-label="Cập nhật cuộc trò chuyện" title="Cập nhật" onClick={() => void resource.reload()} className="!size-9 !min-h-9 !px-0 sm:!size-auto sm:!min-h-9 sm:!px-3">
              <span className="hidden sm:inline">Cập nhật</span>
            </Button>
          </div>
        </div>
        {data && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-3 text-[11px] sm:gap-2 sm:text-xs">
            <button
              className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 font-semibold text-muted transition hover:border-accent/30 hover:bg-tint hover:text-accent"
              onClick={() => setParticipants((v) => !v)}
            >
              <Icon name="users" size={14} />
              {data.participants.length} người tham gia
            </button>
            {data.projectId && (
              <a href={'/projects/' + data.projectId} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line bg-panel px-3 py-1.5 font-semibold text-accent transition hover:border-accent/30 hover:bg-tint">
                <Icon name="folder" size={13} />
                Mở dự án ↗
              </a>
            )}
            {data.teamId && (
              <a href={'/teams/' + data.teamId} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line bg-panel px-3 py-1.5 font-semibold text-accent transition hover:border-accent/30 hover:bg-tint">
                <Icon name="users" size={13} />
                Hồ sơ đội ↗
              </a>
            )}
            {data.peerId && (
              <a href={'/members/' + data.peerId} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-line bg-panel px-3 py-1.5 font-semibold text-accent transition hover:border-accent/30 hover:bg-tint">
                <Icon name="users" size={13} />
                Hồ sơ thành viên ↗
              </a>
            )}
            {data.kind === 'DIRECT' && (
              <button
                disabled={busy || sending}
                onClick={() => void block()}
                className="ml-auto min-h-8 rounded-full px-3 py-1.5 font-semibold text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                {data.myBlocked ? 'Bỏ chặn' : 'Chặn tin nhắn'}
              </button>
            )}
          </div>
        )}
        {participants && data && (
          <ul className="mt-3 max-h-32 overflow-y-auto rounded-2xl border border-line bg-panel p-3 text-xs text-muted">
            {data.participants.map((p) => (
              <li key={p.userId} className="py-1">
                {p.name}
                {p.userId === user ? ' (Bạn)' : ''}
              </li>
            ))}
          </ul>
        )}
        {data && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-panel/60 px-3 py-2 text-[10px] leading-4 text-muted sm:text-[11px]">
            <Icon name="alert" size={13} />
            {data.kind === 'TEAM'
              ? 'Chỉ thành viên hiện tại của đội được xem.'
              : data.kind === 'PROJECT'
                ? 'Thành viên dự án và khách hàng đã xác nhận hợp tác được xem.'
                : 'Chỉ hai tài khoản trong cuộc trò chuyện được xem.'}
          </p>
        )}
      </header>
      {pinnedMessages.length > 0 && (
        <section aria-label="Tin nhắn đã ghim" className="shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const top = pinnedMessages[0];
                setHighlightMessageId(top.id);
                setAround(top.id);
                setBefore(null);
                setAtBottom(false);
              }}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-ink hover:underline"
            >
              <span className="shrink-0 font-bold text-amber-600 dark:text-amber-300">★ Đã ghim ({pinnedMessages.length}):</span>
              <span className="truncate font-semibold">{pinnedMessages[0].senderName}:</span>
              <span className="truncate text-muted">{pinnedMessages[0].body}</span>
            </button>
            <button
              type="button"
              onClick={() => togglePinChatMessage(id, { id: pinnedMessages[0].id, sender_name: pinnedMessages[0].senderName, sender_user_id: '', body: pinnedMessages[0].body, created_at: pinnedMessages[0].pinnedAt })}
              className="shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold text-muted hover:bg-surface hover:text-danger"
            >
              Bỏ ghim
            </button>
          </div>
        </section>
      )}
      {searchOpen && (
        <section aria-label="Tìm tin nhắn trong cuộc trò chuyện" className="shrink-0 border-b border-line bg-panel/50 p-3 sm:px-5">
          <label htmlFor="chat-message-search" className="sr-only">Tìm tin nhắn</label>
          <input
            id="chat-message-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm nội dung tin nhắn…"
            className={inputClass + ' w-full rounded-xl bg-surface'}
            autoFocus
          />
          {searchQuery.trim().length < 2 ? (
            <p className="mt-2 text-xs text-muted">Nhập ít nhất 2 ký tự để tìm trong cuộc trò chuyện này.</p>
          ) : search.error ? (
            <p role="alert" className="mt-2 text-xs text-danger">{search.error}</p>
          ) : !search.data ? (
            <p role="status" className="mt-2 text-xs text-muted">Đang tìm…</p>
          ) : search.data.length === 0 ? (
            <p role="status" className="mt-2 text-xs text-muted">Không tìm thấy tin nhắn phù hợp.</p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto" aria-label="Kết quả tìm kiếm">
              {search.data.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:border-accent/30 hover:bg-tint focus-visible:outline-2 focus-visible:outline-accent"
                    onClick={() => {
                      setHighlightMessageId(message.id);
                      setAround(message.id);
                      setBefore(null);
                      setAtBottom(false);
                      setSearchOpen(false);
                    }}
                  >
                    <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
                      <span className="truncate">{message.sender_name}</span>
                      <ChatInboxTime value={message.created_at} now={new Date()} />
                    </span>
                    <span className="mt-1 block line-clamp-2 whitespace-pre-wrap break-words text-sm text-ink">{message.body || 'Đã gửi ảnh'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {resource.error && (
        <div
          role="alert"
          className="border-b border-line p-3 text-sm text-danger"
        >
          {resource.error}
        </div>
      )}
      <div
        ref={scroll}
        onScroll={(event) => {
          const box = event.currentTarget;
          setAtBottom(box.scrollHeight - box.scrollTop - box.clientHeight < 30);
        }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-panel/40 via-surface to-surface px-3 py-4 sm:space-y-4 sm:px-5 sm:py-5"
        aria-label="Lịch sử tin nhắn"
      >
        {(before || around) && (
          <Button
            kind="secondary"
            size="sm"
            onClick={() => {
              setAround(null);
              setBefore(null);
              setAtBottom(true);
            }}
          >
            Về tin mới nhất
          </Button>
        )}
        {data?.nextBefore && (
          <Button
            kind="ghost"
            size="sm"
            onClick={() => {
              setAround(null);
              setBefore(data.nextBefore);
              setAtBottom(false);
              if (scroll.current) scroll.current.scrollTop = 0;
            }}
          >
            Tin nhắn cũ hơn
          </Button>
        )}
        {!data && !resource.error && (
          <p role="status" className="text-sm text-muted">
            Đang tải tin nhắn…
          </p>
        )}
        {data && !data.items.length && (
          <p className="py-8 text-center text-sm text-muted">
            Chưa có tin nhắn. Gửi lời chào để bắt đầu trao đổi.
          </p>
        )}
        {data && (
          <ChatTimeline
            messages={data.items}
            conversationId={data.id}
            userId={user}
            unreadAfterId={!before && !around ? unreadAfterId : undefined}
            highlightMessageId={highlightMessageId}
            pinnedIds={pinnedMessages.map((m) => m.id)}
            onReply={data.canSend && !resource.error ? (message) => setChatReplyTarget(user, id, message) : undefined}
            onReaction={!data.readOnly && !resource.error ? async (messageId, emoji, remove) => {
              await reactToChatMessage(id, messageId, user, emoji, remove);
              await resource.reload();
            } : undefined}
            onPin={(message) => togglePinChatMessage(id, message)}
            onCreateTask={(message) => setTaskDraftMessage(message)}
            renderReceipt={(message) => <ChatReceiptStatus messageId={message.id} user={user} participants={data.participants} />}
            renderMessage={(message, own) => {
              const imageCount = chatImageCount(message);
              const taskRefs = extractTaskReferences(message.body);
              return (
                <article className={'w-fit max-w-full space-y-1.5 rounded-2xl px-3.5 py-2.5 shadow-sm ' + (own ? 'rounded-br-md bg-accent text-on-accent' : 'rounded-bl-md border border-line bg-surface text-ink')}>
                  {!own && data.kind !== 'DIRECT' && <strong className="block break-words text-[11px] text-muted">{message.sender_name}</strong>}
                  {message.body && (
                    <p className="whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">
                      {message.body}
                    </p>
                  )}
                  {taskRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Thẻ liên kết nhiệm vụ">
                      {taskRefs.map((ref) => (
                        <a
                          key={ref.code}
                          href={`/tasks/${ref.taskNumber}`}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                            own
                              ? 'border-on-accent/30 bg-on-accent/15 text-on-accent hover:bg-on-accent/25'
                              : 'border-accent/30 bg-tint text-accent hover:border-accent'
                          }`}
                        >
                          <Icon name="check" size={13} />
                          <span>#{ref.code} · Mở nhiệm vụ ↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <ChatMessageImages conversationId={id} messageId={message.id} userId={user} count={imageCount} />
                </article>
              );
            }}
          />
        )}
      </div>
      {taskDraftMessage && (
        <Modal
          open
          onClose={() => setTaskDraftMessage(null)}
          title="Tạo nhiệm vụ nhanh từ tin nhắn"
          description="Trích xuất nội dung trao đổi thành nhiệm vụ trong dự án để phân công và theo dõi deadline."
        >
          {(() => {
            const draft = deriveTaskDraftFromMessage(taskDraftMessage);
            return (
              <div className="space-y-4">
                <div className="rounded-xl border border-line bg-panel/50 p-3 text-xs">
                  <span className="font-semibold text-accent">Tin nhắn gốc từ {taskDraftMessage.sender_name}:</span>
                  <p className="mt-1 whitespace-pre-wrap text-muted">{taskDraftMessage.body}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-ink">Tiêu đề nhiệm vụ đề xuất</span>
                  <p className="rounded-xl border border-line bg-surface p-2.5 text-sm font-medium text-ink">{draft.title}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button kind="secondary" onClick={() => setTaskDraftMessage(null)}>
                    Đóng
                  </Button>
                  <Button
                    onClick={() => {
                      const targetHref = data?.projectId
                        ? `/projects/${data.projectId}?tab=tasks`
                        : '/my-projects';
                      setTaskDraftMessage(null);
                      navigateTo(targetHref);
                    }}
                  >
                    {data?.projectId ? 'Mở bảng nhiệm vụ dự án →' : 'Chọn dự án để tạo nhiệm vụ →'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
      {!atBottom && !before && !around && (
        <Button kind="ghost" size="sm" onClick={() => setAtBottom(true)}>
          Về tin nhắn mới nhất ↓
        </Button>
      )}
      {readError && (
        <p role="status" className="px-4 text-xs text-warning">
          Chưa cập nhật trạng thái đã đọc: {readError}
        </p>
      )}
      {error && (
        <p role="alert" className="px-4 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {data?.kind === 'DIRECT' && data.peerId && !data.myBlocked && !resource.error && (
        <ConnectionActions key={data.peerId} userId={data.peerId} inChat chatState={data.connectionState} onChanged={resource.reload} />
      )}
      {typeof data?.remainingBeforeFriendship === 'number' && data.canSend && !resource.error && (
        <p className="px-4 pt-2 text-xs text-muted">Còn {data.remainingBeforeFriendship}/3 tin nhắn trước khi kết bạn.</p>
      )}
      {data?.canSend && !resource.error ? (
        <ChatComposer
          conversationId={id}
          userId={user}
          disabled={busy}
          onSent={() => {
            setAround(null);
            setBefore(null);
            setAtBottom(true);
          }}
        />
      ) : (
        data && (
          <p className="shrink-0 border-t border-line p-4 text-sm text-muted">
            {data.myBlocked
              ? 'Bạn đã chặn tin nhắn riêng từ tài khoản này.'
              : resource.error
                ? 'Tạm dừng gửi tin cho đến khi xác nhận lại quyền truy cập.'
                : data.remainingBeforeFriendship === 0 ? (
                  <>Đã gửi đủ 3 tin nhắn. <a href={'/members/' + data.peerId} className="font-semibold text-accent underline">Mở hồ sơ để kết bạn</a>.</>
                ) : 'Cuộc trò chuyện đang chỉ đọc hoặc không thể nhận tin nhắn mới.'}
          </p>
        )
      )}
    </section>
  );
}
