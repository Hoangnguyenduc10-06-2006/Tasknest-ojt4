import { describe, expect, it } from 'vitest';
import {
  chatLaunch,
  chatImageCount,
  chatMessageInput,
  chatMessagePreview,
  chatSearchPath,
  chatQuery,
  filterConversations,
  type Conversation,
} from './messaging.api';
import {
  requiresSession,
  resolveRoute,
  safeReturnTo,
} from '../../app/router/routes';
describe('messaging destinations', () => {
  it('includes the reply target in message submissions when selected', () => {
    const draft = {
      body: 'Đã rõ',
      clientId: 'message-key',
      replyTo: {
        id: 42,
        sender_user_id: 'peer',
        sender_name: 'Minh',
        body: 'Bạn xem giúp file này nhé',
      },
    };
    expect(chatMessageInput(draft)).toEqual({
      body: 'Đã rõ',
      clientId: 'message-key',
      replyToMessageId: 42,
    });
    expect(chatMessageInput({ body: 'Chào', clientId: 'plain-message' })).toEqual({
      body: 'Chào',
      clientId: 'plain-message',
      replyToMessageId: undefined,
    });
  });
  it('encodes message search terms without changing conversation scope', () => {
    expect(chatSearchPath(12, '  bản vẽ & kế hoạch  ')).toBe(
      '/12/messages/search?q=b%E1%BA%A3n%20v%E1%BA%BD%20%26%20k%E1%BA%BF%20ho%E1%BA%A1ch',
    );
  });
  it('keeps conversations private and allows returning to the selected thread', () => {
    expect(requiresSession('/messages')).toBe(true);
    expect(resolveRoute('/messages').kind).toBe('workspace');
    expect(safeReturnTo('/messages?conversation=12')).toBe(
      '/messages?conversation=12',
    );
    expect(chatQuery('?conversation=12')).toBe(12);
    for (const value of ['0', '-1', '1abc', '9007199254740992', '../2'])
      expect(chatQuery('?conversation=' + value)).toBeNull();
  });
  it('accepts only canonical account IDs and positive room scopes', () => {
    expect(chatLaunch('?user=00000000-0000-4000-8000-000000000001')).toEqual({
      kind: 'DIRECT',
      target: '00000000-0000-4000-8000-000000000001',
    });
    expect(chatLaunch('?team=2')).toEqual({ kind: 'TEAM', target: '2' });
    expect(chatLaunch('?project=3')).toEqual({ kind: 'PROJECT', target: '3' });
    for (const search of [
      '?team=-1',
      '?project=0',
      '?user=bad',
      '?project=NaN',
    ])
      expect(chatLaunch(search)).toBeNull();
  });
  it('filters the loaded inbox by title, room type, sender, and latest message', () => {
    const conversations: Conversation[] = [
      {
        id: 1,
        kind: 'DIRECT',
        title: 'Linh Nguyen',
        teamId: null,
        projectId: null,
        unread: 1,
        lastMessage: {
          id: 10,
          sender_user_id: 'user-2',
          sender_name: 'Minh',
          body: 'Đã cập nhật bản thiết kế',
          created_at: '2026-11-19T08:00:00Z',
        },
      },
      {
        id: 2,
        kind: 'PROJECT',
        title: 'Website khách hàng',
        teamId: null,
        projectId: 4,
        unread: 0,
        lastMessage: null,
      },
    ];

    expect(filterConversations(conversations, '  LINH ')).toEqual([
      conversations[0],
    ]);
    expect(filterConversations(conversations, 'thiết kế')).toEqual([
      conversations[0],
    ]);
    expect(filterConversations(conversations, 'minh')).toEqual([
      conversations[0],
    ]);
    expect(filterConversations(conversations, 'không có')).toEqual([]);
    expect(filterConversations(conversations, '  ')).toBe(conversations);
  });
  it('labels image-only messages in previews without losing accompanying text', () => {
    const message = {
      id: 1,
      sender_user_id: 'user',
      sender_name: 'An',
      body: '',
      created_at: '2026-11-19T09:00:00Z',
      has_image: true,
    };
    expect(chatMessagePreview(message)).toBe('Đã gửi ảnh');
    expect(chatMessagePreview({ ...message, image_count: 4 })).toBe('Đã gửi 4 ảnh');
    expect(chatMessagePreview({ ...message, body: 'Đã xong', has_image: 1 })).toBe(
      '📷 Đã xong',
    );
    expect(
      chatMessagePreview({ ...message, body: 'Tin nhắn', has_image: false }),
    ).toBe('Tin nhắn');
  });
  it('normalizes legacy and multi-image message counts for rendering', () => {
    expect(chatImageCount({ id: 1, sender_user_id: 'u', sender_name: 'An', body: '', created_at: '2026-11-20T00:00:00Z', has_image: true })).toBe(1);
    expect(chatImageCount({ id: 2, sender_user_id: 'u', sender_name: 'An', body: '', created_at: '2026-11-20T00:00:00Z', image_count: 5 })).toBe(5);
    expect(chatImageCount({ id: 3, sender_user_id: 'u', sender_name: 'An', body: '', created_at: '2026-11-20T00:00:00Z', image_count: 99 })).toBe(5);
    expect(chatImageCount({ id: 4, sender_user_id: 'u', sender_name: 'An', body: '', created_at: '2026-11-20T00:00:00Z', image_count: -1 })).toBe(0);
  });
});
