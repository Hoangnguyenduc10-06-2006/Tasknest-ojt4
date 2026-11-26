import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getInbox, markAllNotificationsRead, markNotificationRead, type Inbox, type NotificationItem } from '../api/inbox.api';
import { createInboxRefresh } from '../model/inbox-refresh';
import { createNotificationPopupTracker } from '../model/notification-popups';

const popupLimit = 3;

export function useInbox(userId?: string) {
  const [state, setState] = useState<{
    userId?: string;
    data?: Inbox;
    error?: string;
    popups?: NotificationItem[];
  }>({});
  const [page, setPage] = useState(0);
  const [size,setSize] = useState(20);
  const [category, setCategory] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const selection = useMemo(() => ({ userId, page, size, category, unreadOnly }), [userId, page, size, category, unreadOnly]);
  const activeSelection = useRef<typeof selection | undefined>(selection);
  const generation = useRef(0);
  const activeUser = useRef(userId);
  const busy = useRef(false);
  const popupHistory = useRef<{
    userId: string;
    tracker: ReturnType<typeof createNotificationPopupTracker>;
  } | null>(null);
  const refresh = useMemo(() => createInboxRefresh(async () => {
    if (!userId || activeUser.current !== userId || activeSelection.current !== selection) return;
    const request = generation.current;
    const latest = getInbox(userId, 0, page === 0 ? size : 20);
    const selected = page === 0 && category === 'all' && !unreadOnly
      ? latest
      : getInbox(userId, page, size, category, unreadOnly);
    const [head, selectedPage] = await Promise.allSettled([latest, selected]);
    if (generation.current !== request || activeUser.current !== userId) return;

    const latestItems = head.status === 'fulfilled' ? head.value.items : [];
    const incoming = head.status === 'fulfilled' && popupHistory.current?.userId === userId
      ? popupHistory.current.tracker.take(latestItems)
      : [];
    const data = selectedPage.status === 'fulfilled' ? selectedPage.value : undefined;
    const error = selectedPage.status === 'rejected' ? selectedPage.reason : undefined;
    const readIds = new Set([...latestItems, ...(data?.items ?? [])].filter(item => item.readAt).map(item => item.id));
    setState(previous => ({
      userId,
      data,
      error: selectedPage.status === 'rejected'
        ? error instanceof Error ? error.message : 'Không thể tải thông báo.'
        : undefined,
      popups: [
        ...incoming,
        ...(previous.userId === userId ? previous.popups ?? [] : []).filter(item => !readIds.has(item.id)),
      ].slice(0, popupLimit),
    }));
  }), [userId, page, size, category, unreadOnly, selection]);
  useEffect(() => {
    activeSelection.current = selection;
    activeUser.current = userId;
    if (popupHistory.current?.userId !== userId) {
      popupHistory.current = userId ? { userId, tracker: createNotificationPopupTracker() } : null;
    }
    void refresh();
    const focus = () => {
      void refresh();
    };
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    window.addEventListener('focus', focus);
    window.addEventListener('tasknest:sync', focus);
    const cancelPending = () => {
      generation.current++;
      activeUser.current = undefined;
      activeSelection.current = undefined;
    };
    return () => {
      cancelPending();
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('tasknest:sync', focus);
    };
  }, [refresh, userId, selection]);
  const dismissPopup = useCallback((id: number) => {
    setState(previous => previous.userId === userId && previous.popups
      ? { ...previous, popups: previous.popups.filter(item => item.id !== id) }
      : previous);
  }, [userId]);
  const read = async (id: number) => {
    if (!userId || busy.current || activeUser.current !== userId) return false;
    busy.current = true;
    try {
      await markNotificationRead(userId, id);
      if (activeUser.current !== userId) return false;
      setState(previous => {
        if (previous.userId !== userId || !previous.data) return previous;
        const unread = previous.data.items.some(item => item.id === id && !item.readAt);
        return { ...previous, data: { ...previous.data,
          unreadCount: Math.max(0, previous.data.unreadCount - (unread ? 1 : 0)),
          items: previous.data.items.map(item => item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item),
        } };
      });
      dismissPopup(id);
      await refresh();
      return true;
    } catch (error) {
      if (activeUser.current === userId)
        setState((previous) => ({
          ...previous,
          error:
            error instanceof Error
              ? error.message
              : 'Không thể đánh dấu đã đọc.',
        }));
      return false;
    } finally {
      busy.current = false;
    }
  };
  const readAll = async () => {
    if (!userId || busy.current) return;
    busy.current = true;
    try {
      await markAllNotificationsRead(userId);
      if (activeUser.current !== userId) return;
      const nowIso = new Date().toISOString();
      setState(previous => previous.userId === userId && previous.data
        ? {
            ...previous,
            popups: [],
            data: {
              ...previous.data,
              unreadCount: 0,
              matchingUnreadCount: 0,
              items: previous.data.items.map(item => item.readAt ? item : { ...item, readAt: nowIso }),
            },
          }
        : previous);
      await refresh();
    } catch (error) {
      if (activeUser.current === userId) setState(previous => ({ ...previous, error: error instanceof Error ? error.message : 'Không thể đánh dấu tất cả đã đọc.' }));
    } finally { busy.current = false; }
  };
  return {
    ...(state.userId === userId ? state : {}),
    dismissPopup,
    page,
    setPage,
    category,
    setCategory: (value: string) => { setCategory(value); setPage(0); },
    unreadOnly,
    setUnreadOnly: (value: boolean) => { setUnreadOnly(value); setPage(0); },
    size,
    setSize: (value: number) => { setSize(value);setPage(0); },
    refresh,
    read,
    readAll,
  };
}
