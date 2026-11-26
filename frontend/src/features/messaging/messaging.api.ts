import type { ConnectionState } from '../community/ConnectionsPage';
import { ApiError, requestBlob, requestForm } from '../../shared/api/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedAccessToken } from '../auth';
import { communityRequest, errorMessage } from '../community/community.api';
export type ChatKind = 'DIRECT' | 'TEAM' | 'PROJECT';
export type ChatMessage = {
  id: number;
  sender_user_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  has_image?: boolean | 0 | 1;
  image_count?: number;
  reactions?: ChatReaction[];
  reply_to?: ChatReplyTarget | null;
};
export type ChatReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};
export type ChatReplyTarget = Pick<
  ChatMessage,
  'id' | 'sender_user_id' | 'sender_name' | 'body' | 'has_image'
>;
export type ChatDraft = {
  body: string;
  clientId: string;
  images?: File[];
  replyTo?: ChatReplyTarget;
};
export type Conversation = {
  id: number;
  kind: ChatKind;
  title: string;
  teamId: number | null;
  projectId: number | null;
  peerId?: string;
  unread: number;
  lastMessage: ChatMessage | null;
};
export type ChatHistory = Conversation & {
  items: ChatMessage[];
  nextBefore: number | null;
  canSend: boolean;
  readOnly?: boolean;
  myBlocked: boolean;
  connectionState?: ConnectionState;
  remainingBeforeFriendship?: number | null;
  myReadId: number;
  participants: { userId: string; name: string; readId: number }[];
};
export type ChatList = {
  items: Conversation[];
  hasMore: boolean;
  unreadCount: number;
};
export type ChatSpaces = {
  teams: { id: number; name: string }[];
  projects: { id: number; name: string }[];
};
export const kindLabel = {
  DIRECT: 'Trò chuyện riêng',
  TEAM: 'Nội bộ đội',
  PROJECT: 'Trao đổi dự án',
};
export const chatImageMaxBytes = 5 * 1024 * 1024;
export const chatImagesMaxCount = 5;

export function chatSearchPath(id: number, query: string) {
  return '/' + id + '/messages/search?q=' + encodeURIComponent(query.trim());
}

export function chatMessagePreview(message: ChatMessage) {
  if (message.has_image) {
    const count = chatImageCount(message);
    const photoLabel = count > 1 ? `Đã gửi ${count} ảnh` : 'Đã gửi ảnh';
    return message.body ? '📷 ' + message.body : photoLabel;
  }
  return message.body;
}

export function chatImageCount(message: ChatMessage) {
  const count = Number(message.image_count);
  return Number.isSafeInteger(count) && count > 0
    ? Math.min(5, count)
    : message.has_image
      ? 1
      : 0;
}

export function chatMessageInput(draft: ChatDraft) {
  return {
    body: draft.body,
    clientId: draft.clientId,
    replyToMessageId: draft.replyTo?.id,
  };
}

export async function sendChatMessage(id: number, userId: string, draft: ChatDraft) {
  const path = 'community/chat/' + id + '/messages';
  const images = draft.images ?? [];
  const input = chatMessageInput(draft);
  if (!images.length) return communityRequest<number>(path, userId, input, 'POST');
  const form = new FormData();
  form.set('clientId', input.clientId);
  if (input.body.trim()) form.set('body', input.body);
  if (input.replyToMessageId) form.set('replyToMessageId', String(input.replyToMessageId));
  images.forEach((image) => form.append('file', image));
  const token = await authenticatedAccessToken(userId);
  const response = await requestForm<{ data: number }>('/api/work/' + path, form, token);
  return response.data;
}

export async function chatImageBlob(id: number, messageId: number, userId: string, slot = 1) {
  const token = await authenticatedAccessToken(userId);
  const blob = await requestBlob(`/api/work/community/chat/${id}/messages/${messageId}/images/${slot}`, token);
  if (blob.type !== 'image/jpeg' && blob.type !== 'image/png') {
    throw new Error('Không thể hiển thị định dạng ảnh này.');
  }
  return blob;
}

export function reactToChatMessage(id: number, messageId: number, userId: string, emoji: string, remove = false) {
  return communityRequest<void>(
    `community/chat/${id}/messages/${messageId}/reaction`,
    userId,
    { emoji },
    remove ? 'DELETE' : 'PUT',
  );
}

export function filterConversations(items: Conversation[], query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return items;
  return items.filter((room) =>
    [
      room.title,
      kindLabel[room.kind],
      room.lastMessage && chatMessagePreview(room.lastMessage),
      room.lastMessage?.sender_name,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalized)),
  );
}
export function useChatResource<T>(
  path: string | null,
  user?: string,
  interval = 10000,
) {
  const key = user + '/' + path;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    initialData?: T;
    error?: string;
  }>({ key: '' });
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    if (!path || !user) return;
    const revision = ++sequence.current;
    try {
      const data = await communityRequest<T>('community/chat' + path, user);
      if (sequence.current === revision)
        setState((previous) => ({
          key,
          data,
          initialData: previous.key === key ? previous.initialData ?? data : data,
        }));
    } catch (error) {
      if (sequence.current === revision)
        setState((previous) => ({
          key,
          data:
            error instanceof ApiError && [401, 403, 404].includes(error.status)
              ? undefined
              : previous.key === key
                ? previous.data
                : undefined,
          initialData: previous.key === key ? previous.initialData : undefined,
          error: errorMessage(error),
        }));
    }
  }, [key, path, user]);
  useEffect(() => {
    const update = () => {
      if (!document.hidden) void reload();
    };
    void reload();
    const timer = window.setInterval(update, interval);
    window.addEventListener('tasknest:sync', update);
    window.addEventListener('tasknest:chat-read', update);
    window.addEventListener('tasknest:chat-sent', update);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    const cancel = () => {
      sequence.current++;
    };
    return () => {
      cancel();
      clearInterval(timer);
      window.removeEventListener('tasknest:sync', update);
      window.removeEventListener('tasknest:chat-read', update);
      window.removeEventListener('tasknest:chat-sent', update);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [reload, interval]);
  return {
    data: state.key === key ? state.data : undefined,
    initialData: state.key === key ? state.initialData : undefined,
    error: state.key === key ? state.error : undefined,
    reload,
  };
}
export function chatQuery(search: string) {
  const params = new URLSearchParams(search);
  const id = params.get('conversation');
  return id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))
    ? Number(id)
    : null;
}
export function chatLaunch(
  search: string,
): { kind: ChatKind; target: string } | null {
  const params = new URLSearchParams(search);
  const peer = params.get('user');
  if (
    peer &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(peer)
  )
    return { kind: 'DIRECT', target: peer };
  for (const [key, kind] of [
    ['team', 'TEAM'],
    ['project', 'PROJECT'],
  ] as const) {
    const value = params.get(key);
    if (
      value &&
      /^[1-9]\d*$/.test(value) &&
      Number.isSafeInteger(Number(value))
    )
      return { kind, target: value };
  }
  return null;
}
