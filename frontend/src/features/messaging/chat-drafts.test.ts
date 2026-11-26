import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publishSession } from '../auth/model/session.store';
import {
  clearChatReplyTarget,
  getChatComposerState,
  setChatReplyTarget,
  updateChatComposerState,
} from './chat-drafts';

function signIn(id: string, emailVerified = true) {
  publishSession({
    status: 'authenticated',
    user: { id, fullName: id, email: id + '@example.com', emailVerified },
    expiresAt: Date.now() + 120000,
    refreshAt: Date.now() + 60000,
  });
}

const draft = () => ({
  body: 'Bản thiết kế mới',
  clientId: '00000000-0000-4000-8000-000000000001',
  images: [
    new File(['image content'], 'design.png', { type: 'image/png' }),
    new File(['second image'], 'flow.jpg', { type: 'image/jpeg' }),
  ],
});

describe('private chat drafts', () => {
  beforeEach(() => {
    publishSession({ status: 'guest' });
    signIn('alice');
  });
  afterEach(() => publishSession({ status: 'guest' }));

  it('keeps the same text, image files, and retry key for one account and room across session refreshes', () => {
    const pending = draft();
    updateChatComposerState('alice', 10, { draft: pending });
    signIn('alice');

    const restored = getChatComposerState('alice', 10);
    expect(restored.draft).toBe(pending);
    expect(restored.draft?.images).toBe(pending.images);
    expect(restored.draft?.body).toBe('Bản thiết kế mới');
    expect(restored.draft?.clientId).toBe(pending.clientId);
  });

  it('isolates drafts and sending state by conversation', () => {
    const pending = draft();
    updateChatComposerState('alice', 10, { draft: pending, sending: true });
    updateChatComposerState('alice', 20, {
      draft: { body: 'Một cuộc trò chuyện khác', clientId: 'another-key' },
    });

    expect(getChatComposerState('alice', 10)).toEqual({ draft: pending, sending: true });
    expect(getChatComposerState('alice', 20).draft?.body).toBe('Một cuộc trò chuyện khác');
    expect(getChatComposerState('alice', 20).sending).toBeUndefined();
    expect(getChatComposerState('alice', 30)).toEqual({});
    updateChatComposerState('alice', 10, {});
    expect(getChatComposerState('alice', 10)).toEqual({});
    expect(getChatComposerState('alice', 20).draft?.body).toBe('Một cuộc trò chuyện khác');
  });

  it('keeps reply context with the draft and clears only the reply metadata', () => {
    const pending = draft();
    updateChatComposerState('alice', 10, { draft: pending });
    const target = {
      id: 42,
      sender_user_id: 'bob',
      sender_name: 'Bob',
      body: 'Xem giúp mình nhé',
    };
    setChatReplyTarget('alice', 10, target);

    const replying = getChatComposerState('alice', 10).draft;
    expect(replying?.replyTo).toEqual(target);
    expect(replying?.body).toBe(pending.body);
    expect(replying?.images).toBe(pending.images);
    expect(replying?.clientId).not.toBe(pending.clientId);

    clearChatReplyTarget('alice', 10);
    const cleared = getChatComposerState('alice', 10).draft;
    expect(cleared?.replyTo).toBeUndefined();
    expect(cleared?.body).toBe(pending.body);
    expect(cleared?.images).toBe(pending.images);
  });

  it('keeps an empty reply-only draft while removing it when the target is cleared', () => {
    setChatReplyTarget('alice', 10, {
      id: 42,
      sender_user_id: 'bob',
      sender_name: 'Bob',
      body: 'Câu hỏi',
    });
    expect(getChatComposerState('alice', 10).draft?.body).toBe('');
    clearChatReplyTarget('alice', 10);
    expect(getChatComposerState('alice', 10)).toEqual({});
  });

  it('clears private drafts on account switch and does not restore them when switching back', () => {
    updateChatComposerState('alice', 10, { draft: draft() });
    signIn('bob');

    expect(getChatComposerState('alice', 10)).toEqual({});
    expect(getChatComposerState('bob', 10)).toEqual({});
    signIn('alice');
    expect(getChatComposerState('alice', 10)).toEqual({});
  });

  it('does not let a pending send write into the next signed-in account', () => {
    const pending = draft();
    updateChatComposerState('alice', 10, { draft: pending, sending: true });
    signIn('bob');
    const bobDraft = { body: 'Nội dung của Bob', clientId: 'bob-key' };
    updateChatComposerState('bob', 10, { draft: bobDraft });

    updateChatComposerState('alice', 10, { draft: pending, error: 'Tải ảnh thất bại' });
    updateChatComposerState('alice', 10, {});
    expect(getChatComposerState('alice', 10)).toEqual({});
    expect(getChatComposerState('bob', 10)).toEqual({ draft: bobDraft });
  });

  it('clears drafts and rejects a late send callback after logout', () => {
    const pending = draft();
    updateChatComposerState('alice', 10, { draft: pending, sending: true });
    publishSession({ status: 'guest' });
    updateChatComposerState('alice', 10, { draft: pending, error: 'Mất kết nối' });

    expect(getChatComposerState('alice', 10)).toEqual({});
    signIn('alice');
    expect(getChatComposerState('alice', 10)).toEqual({});
  });

  it('clears private drafts if the current account is no longer verified', () => {
    updateChatComposerState('alice', 10, { draft: draft() });
    signIn('alice', false);
    expect(getChatComposerState('alice', 10)).toEqual({});
    signIn('alice');
    expect(getChatComposerState('alice', 10)).toEqual({});
  });
});
