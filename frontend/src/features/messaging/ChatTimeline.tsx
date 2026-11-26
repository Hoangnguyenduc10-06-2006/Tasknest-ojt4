import { UserAvatar } from '../profile/components/UserAvatar';
import { useState, type ReactNode } from 'react';
import { errorMessage } from '../community/community.api';
import { Icon } from '../../shared/ui/Icon';
import { incomingUnread } from './chat-unread';
import { getChatTimestamp, startsChatDayGroup } from './chat-time';
import type { ChatMessage } from './messaging.api';

export function ChatInboxTime({ value, now }: { value?: string; now: Date }) {
  const timestamp = value ? getChatTimestamp(value, now) : undefined;
  if (!timestamp) return null;
  return (
    <time dateTime={timestamp.dateTime} title={timestamp.exact} className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-muted">
      {timestamp.inbox}
    </time>
  );
}

export function ChatTimeline({
  messages,
  conversationId,
  userId,
  unreadAfterId,
  highlightMessageId,
  pinnedIds,
  onReply,
  onReaction,
  onPin,
  onCreateTask,
  renderReceipt,
  renderMessage,
}: {
  messages: ChatMessage[];
  conversationId: number;
  userId: string;
  unreadAfterId?: number;
  highlightMessageId?: number;
  pinnedIds?: number[];
  onReply?: (message: ChatMessage) => void;
  onReaction?: (messageId: number, emoji: string, remove: boolean) => Promise<void>;
  onPin?: (message: ChatMessage) => void;
  onCreateTask?: (message: ChatMessage) => void;
  renderReceipt?: (message: ChatMessage) => ReactNode;
  renderMessage: (message: ChatMessage, own: boolean) => ReactNode;
}) {
  const [reactionPickerId, setReactionPickerId] = useState<number>();
  const [pendingReactionId, setPendingReactionId] = useState<number>();
  const [reactionError, setReactionError] = useState('');
  const now = new Date();
  const unread = unreadAfterId === undefined
    ? { count: 0, firstMessageId: null }
    : incomingUnread(messages, userId, unreadAfterId);

  return messages.map((message, index) => {
    const own = message.sender_user_id === userId;
    const timestamp = getChatTimestamp(message.created_at, now);
    const startsDay = timestamp && startsChatDayGroup(messages[index - 1]?.created_at, message.created_at);
    return (
      <div
        key={message.id}
        id={'chat-message-' + message.id}
        className={highlightMessageId === message.id ? 'rounded-xl ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}
      >
        {message.id === unread.firstMessageId && (
          <div className="mb-3 flex items-center gap-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
            <span aria-hidden="true" className="h-px flex-1 bg-accent/25" />
            Tin nhắn mới{unread.count > 1 ? ` · ${unread.count}` : ''}
            <span aria-hidden="true" className="h-px flex-1 bg-accent/25" />
          </div>
        )}
        {startsDay && (
          <div className="mb-2 flex items-center gap-2 px-1 py-1 text-[11px] font-medium text-muted">
            <span aria-hidden="true" className="h-px flex-1 bg-line" />
            <time dateTime={timestamp.dateTime} title={timestamp.exact}>{timestamp.dayLabel}</time>
            <span aria-hidden="true" className="h-px flex-1 bg-line" />
          </div>
        )}
        <div className={'group/message flex items-end gap-1.5 ' + (own ? 'flex-row-reverse' : '')}>
          {!own && /^[0-9a-f-]{36}$/.test(message.sender_user_id) && (
            <a href={'/members/' + message.sender_user_id} aria-label={'Xem hồ sơ ' + message.sender_name} className="mb-5 shrink-0 rounded-full">
              <UserAvatar userId={message.sender_user_id} name={message.sender_name} conversationId={conversationId} publicProfile className="!size-7" />
            </a>
          )}
          <div className={'flex min-w-0 max-w-full flex-col ' + (own ? 'items-end' : 'items-start')}>
            {message.reply_to && (
              <div className="mb-1.5 min-w-0 max-w-full rounded-e-xl border-s-2 border-accent/50 bg-tint px-2.5 py-1.5 text-xs leading-4 text-muted">
                <span className="block truncate font-semibold text-ink">{message.reply_to.sender_user_id === userId ? 'Bạn' : message.reply_to.sender_name}</span>
                <span className="block truncate">{message.reply_to.has_image && !message.reply_to.body ? 'Đã gửi ảnh' : message.reply_to.body}</span>
              </div>
            )}
            {renderMessage(message, own)}
            {!!message.reactions?.length && (
              <div className={'mt-1 flex max-w-full flex-wrap gap-1 ' + (own ? 'justify-end' : 'justify-start')} aria-label="Cảm xúc trên tin nhắn">
                {message.reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    type="button"
                    disabled={pendingReactionId === message.id}
                    aria-pressed={reaction.reactedByMe}
                    aria-label={`${reaction.emoji}, ${reaction.count} lượt${reaction.reactedByMe ? ', bạn đã thả cảm xúc này' : ''}`}
                    title={reaction.reactedByMe ? 'Bỏ cảm xúc' : 'Thả cảm xúc'}
                    onClick={() => void toggleReaction(message.id, reaction.emoji, reaction.reactedByMe)}
                    className={'inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-xs shadow-sm transition disabled:opacity-50 ' + (reaction.reactedByMe ? 'border-accent/40 bg-tint text-accent' : 'border-line bg-surface text-ink hover:bg-panel')}
                  >
                    <span aria-hidden="true">{reaction.emoji}</span><span className="tabular-nums">{reaction.count}</span>
                  </button>
                ))}
              </div>
            )}
            <div className={'mt-1 flex max-w-full flex-wrap items-center gap-x-2 px-1 text-[10px] leading-4 text-muted ' + (own ? 'justify-end text-right' : 'justify-start')}>
              {timestamp && <time dateTime={timestamp.dateTime} title={timestamp.exact} className="whitespace-nowrap">{timestamp.relative}</time>}
              {own && renderReceipt?.(message)}
            </div>
          </div>
          {(onReply || onReaction) && (
            <div className="relative flex shrink-0 items-center gap-0.5 pb-1">
              {onReaction && (
                <>
                  <button
                    type="button"
                    aria-label={`Thả cảm xúc cho tin nhắn ${message.id}`}
                    aria-expanded={reactionPickerId === message.id}
                    title="Thả cảm xúc"
                    onClick={() => {
                      setReactionError('');
                      setReactionPickerId(reactionPickerId === message.id ? undefined : message.id);
                    }}
                    className={'grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-tint hover:text-accent focus-visible:outline-2 focus-visible:outline-accent [@media(hover:hover)]:opacity-0 group-hover/message:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ' + (reactionPickerId === message.id ? 'bg-tint text-accent' : '')}
                  >
                    <Icon name="smile" size={17} />
                  </button>
                  {reactionPickerId === message.id && (
                    <div className={'absolute bottom-10 z-20 flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-lg ' + (own ? 'right-0' : 'left-0')} role="group" aria-label="Chọn cảm xúc">
                      {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                        <button key={emoji} type="button" disabled={pendingReactionId === message.id} aria-label={`Thả ${emoji}`} onClick={() => void toggleReaction(message.id, emoji, Boolean(message.reactions?.find((reaction) => reaction.emoji === emoji)?.reactedByMe))} className="grid size-8 place-items-center rounded-full text-lg transition hover:scale-125 hover:bg-tint focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50">{emoji}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {onReply && (
                <button
                  type="button"
                  aria-label={'Trả lời ' + (own ? 'tin nhắn của bạn' : 'tin nhắn của ' + message.sender_name)}
                  title="Trả lời"
                  onClick={() => onReply(message)}
                  className="grid size-8 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-tint hover:text-accent focus-visible:outline-2 focus-visible:outline-accent [@media(hover:hover)]:opacity-0 group-hover/message:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <span aria-hidden="true" className="-scale-x-100"><Icon name="arrow" size={15} /></span>
                </button>
              )}
              {onPin && (
                <button
                  type="button"
                  aria-label={(pinnedIds?.includes(message.id) ? 'Bỏ ghim tin nhắn ' : 'Ghim tin nhắn ') + message.id}
                  title={pinnedIds?.includes(message.id) ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn quan trọng'}
                  onClick={() => onPin(message)}
                  className={`grid size-8 shrink-0 place-items-center rounded-xl transition hover:bg-tint hover:text-accent focus-visible:outline-2 focus-visible:outline-accent [@media(hover:hover)]:opacity-0 group-hover/message:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 ${pinnedIds?.includes(message.id) ? '!opacity-100 text-amber-500' : 'text-muted'}`}
                >
                  <span aria-hidden="true" className="text-xs font-bold">★</span>
                </button>
              )}
              {onCreateTask && message.body && (
                <button
                  type="button"
                  aria-label={`Tạo nhiệm vụ từ tin nhắn ${message.id}`}
                  title="Tạo nhiệm vụ từ tin nhắn này"
                  onClick={() => onCreateTask(message)}
                  className="grid size-8 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-tint hover:text-accent focus-visible:outline-2 focus-visible:outline-accent [@media(hover:hover)]:opacity-0 group-hover/message:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Icon name="check" size={15} />
                </button>
              )}
            </div>
          )}
        </div>
        {reactionError && reactionPickerId === message.id && <p role="alert" className={'mt-1 max-w-xs break-words rounded-lg bg-danger/10 px-2 py-1 text-xs text-danger ' + (own ? 'ml-auto text-right' : '')}>{reactionError}</p>}
      </div>
    );
  });

  async function toggleReaction(messageId: number, emoji: string, remove: boolean) {
    if (!onReaction || pendingReactionId) return;
    setPendingReactionId(messageId);
    setReactionError('');
    try {
      await onReaction(messageId, emoji, remove);
      setReactionPickerId(undefined);
    } catch (error) {
      setReactionError(errorMessage(error));
    } finally {
      setPendingReactionId(undefined);
    }
  }
}
