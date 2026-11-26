import { useSyncExternalStore } from 'react';
import type { ChatMessage } from './messaging.api';

export type PinnedChatMessage = {
  id: number;
  senderName: string;
  body: string;
  pinnedAt: string;
};

const PINNED_CHAT_PREFIX = 'tasknest:chat-pinned:';
const listeners = new Set<() => void>();
const pinnedCache = new Map<number, PinnedChatMessage[]>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribePinnedChat(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPinnedChatMessages(conversationId: number): PinnedChatMessage[] {
  const cached = pinnedCache.get(conversationId);
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(PINNED_CHAT_PREFIX + conversationId);
    if (!raw) {
      const empty: PinnedChatMessage[] = [];
      pinnedCache.set(conversationId, empty);
      return empty;
    }
    const parsed = JSON.parse(raw) as unknown;
    const normalized = Array.isArray(parsed)
      ? parsed.filter((m): m is PinnedChatMessage => Boolean(m && typeof m === 'object' && typeof (m as PinnedChatMessage).id === 'number'))
      : [];
    pinnedCache.set(conversationId, normalized);
    return normalized;
  } catch {
    const empty: PinnedChatMessage[] = [];
    pinnedCache.set(conversationId, empty);
    return empty;
  }
}

export function togglePinChatMessage(conversationId: number, message: ChatMessage): PinnedChatMessage[] {
  const current = getPinnedChatMessages(conversationId);
  const exists = current.some((item) => item.id === message.id);
  const next = exists
    ? current.filter((item) => item.id !== message.id)
    : [
        {
          id: message.id,
          senderName: message.sender_name,
          body: (message.body || 'Hình ảnh đính kèm').slice(0, 240),
          pinnedAt: new Date().toISOString(),
        },
        ...current,
      ].slice(0, 5);
  pinnedCache.set(conversationId, next);
  try {
    window.localStorage.setItem(PINNED_CHAT_PREFIX + conversationId, JSON.stringify(next));
  } catch {
    // Keep in-memory state
  }
  emit();
  return next;
}

export function usePinnedChatMessages(conversationId: number) {
  return useSyncExternalStore(
    subscribePinnedChat,
    () => getPinnedChatMessages(conversationId),
    () => []
  );
}

export type TaskReferenceToken = {
  code: string;
  taskNumber: string;
};

export function extractTaskReferences(text?: string | null): TaskReferenceToken[] {
  if (!text) return [];
  const regex = /#?TSK-(\d+)/gi;
  const seen = new Set<string>();
  const result: TaskReferenceToken[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const num = match[1];
    const code = `TSK-${num}`;
    if (!seen.has(code)) {
      seen.add(code);
      result.push({ code, taskNumber: num });
    }
  }
  return result;
}

export function deriveTaskDraftFromMessage(message: ChatMessage): { title: string; description: string } {
  const body = (message.body || '').trim();
  const firstLine = body.split(/\r?\n|[.!?]/)[0]?.trim() || 'Nhiệm vụ từ cuộc trò chuyện';
  const title = firstLine.length >= 3 ? firstLine.slice(0, 95) : `Nhiệm vụ từ ${message.sender_name}`;
  const description = `Trích từ tin nhắn của ${message.sender_name}:\n"${body}"`;
  return { title, description };
}
