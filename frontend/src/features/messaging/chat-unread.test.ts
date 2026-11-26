import { describe, expect, it } from 'vitest';
import type { ChatMessage } from './messaging.api';
import { incomingUnread } from './chat-unread';

const messages = [
  { id: 1, sender_user_id: 'peer', sender_name: 'An', body: 'Cũ', created_at: '' },
  { id: 2, sender_user_id: 'me', sender_name: 'Tôi', body: 'Trả lời', created_at: '' },
  { id: 3, sender_user_id: 'peer', sender_name: 'An', body: 'Mới 1', created_at: '' },
  { id: 4, sender_user_id: 'peer', sender_name: 'An', body: 'Mới 2', created_at: '' },
] satisfies ChatMessage[];

describe('incoming chat unread messages', () => {
  it('finds the first incoming message after the reader marker', () => {
    expect(incomingUnread(messages, 'me', 2)).toEqual({
      count: 2,
      firstMessageId: 3,
    });
  });

  it('does not count the viewer own messages as unread', () => {
    expect(incomingUnread(messages, 'me', 1)).toEqual({
      count: 2,
      firstMessageId: 3,
    });
  });

  it('returns an empty result when all incoming messages are read', () => {
    expect(incomingUnread(messages, 'me', 4)).toEqual({
      count: 0,
      firstMessageId: null,
    });
  });

  it('does not count messages sent by the viewer even with an old marker', () => {
    expect(incomingUnread([messages[1]!], 'me', 0)).toEqual({
      count: 0,
      firstMessageId: null,
    });
  });
});
