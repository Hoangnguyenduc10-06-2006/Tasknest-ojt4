import type { ChatMessage } from './messaging.api';

export type IncomingUnread = {
  count: number;
  firstMessageId: number | null;
};


export function incomingUnread(
  messages: ChatMessage[],
  userId: string,
  readThroughId: number,
): IncomingUnread {
  const unread = messages.filter(
    (message) => message.sender_user_id !== userId && message.id > readThroughId,
  );
  return { count: unread.length, firstMessageId: unread[0]?.id ?? null };
}
