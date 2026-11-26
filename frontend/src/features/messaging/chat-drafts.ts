import { useSyncExternalStore } from 'react';
import { getSessionSnapshot, subscribeSession } from '../auth/model/session.store';
import type { ChatDraft, ChatReplyTarget } from './messaging.api';

type ComposerState = {
  draft?: ChatDraft;
  sending?: boolean;
  error?: string;
};
const empty: ComposerState = {};
const drafts = new Map<number, ComposerState>();
const listeners = new Set<() => void>();
let owner: string | undefined;

function notify() {
  listeners.forEach((listener) => listener());
}

function syncOwner() {
  const session = getSessionSnapshot();
  if (session.status === 'checking' || session.status === 'error') return;
  const next =
    session.status === 'authenticated' && session.user.emailVerified
      ? session.user.id
      : undefined;
  if (next === owner) return;
  owner = next;
  drafts.clear();
  notify();
}

// Keep private drafts (including pending image files) in memory for this session.
syncOwner();
subscribeSession(syncOwner);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getChatComposerState(userId: string, id: number): ComposerState {
  return (userId === owner ? drafts.get(id) : undefined) ?? empty;
}

export function updateChatComposerState(
  userId: string,
  id: number,
  state: ComposerState,
) {
  if (userId !== owner) return;
  if (state.draft || state.sending || state.error) drafts.set(id, state);
  else drafts.delete(id);
  notify();
}

export function setChatReplyTarget(
  userId: string,
  id: number,
  target: ChatReplyTarget,
) {
  const current = getChatComposerState(userId, id);
  if (current.sending) return;
  updateChatComposerState(userId, id, {
    draft: {
      ...(current.draft ?? { body: '', clientId: crypto.randomUUID() }),
      clientId: crypto.randomUUID(),
      replyTo: {
        id: target.id,
        sender_user_id: target.sender_user_id,
        sender_name: target.sender_name,
        body: target.body,
        has_image: target.has_image,
      },
    },
  });
}

export function clearChatReplyTarget(userId: string, id: number) {
  const current = getChatComposerState(userId, id);
  if (current.sending || !current.draft?.replyTo) return;
  const draft = { ...current.draft };
  delete draft.replyTo;
  if (!draft.body && !draft.images?.length) updateChatComposerState(userId, id, {});
  else updateChatComposerState(userId, id, { draft: { ...draft, clientId: crypto.randomUUID() } });
}

export function useChatComposerState(userId: string, id: number) {
  return useSyncExternalStore(
    subscribe,
    () => getChatComposerState(userId, id),
    () => empty,
  );
}
