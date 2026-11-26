import { describe, expect, it } from 'vitest';
import { chatReceipt } from './chat-receipts';

describe('chat message receipts', () => {
  const participants = [
    { userId: 'sender', name: 'An', readId: 0 },
    { userId: 'peer-a', name: 'Bình', readId: 8 },
    { userId: 'peer-b', name: 'Minh', readId: 4 },
  ];

  it('reports sent until a recipient read marker reaches the message', () => {
    expect(chatReceipt(9, 'sender', participants)).toEqual({
      status: 'sent',
      seenBy: 0,
      recipients: 2,
      readers: [],
    });
  });

  it('reports seen once at least one current recipient read the message', () => {
    expect(chatReceipt(8, 'sender', participants)).toEqual({
      status: 'seen',
      seenBy: 1,
      recipients: 2,
      readers: ['Bình'],
    });
  });

  it('counts every recipient and excludes the sender from the receipt', () => {
    expect(chatReceipt(4, 'sender', participants)).toEqual({
      status: 'seen',
      seenBy: 2,
      recipients: 2,
      readers: ['Bình', 'Minh'],
    });
  });

  it('keeps sent status when the room has no other current participants', () => {
    expect(chatReceipt(1, 'sender', [{ userId: 'sender', readId: 1 }])).toEqual({
      status: 'sent',
      seenBy: 0,
      recipients: 0,
      readers: [],
    });
  });

  it('ignores invalid message IDs', () => {
    expect(chatReceipt(0, 'sender', participants)).toBeUndefined();
    expect(chatReceipt(Number.MAX_SAFE_INTEGER + 1, 'sender', participants)).toBeUndefined();
  });
});
