import { useEffect, useState } from 'react';
import { navigateTo } from '../../../app/router/location';
import { Icon } from '../../../shared/ui/Icon';
import type { NotificationItem } from '../api/inbox.api';
import type { useInbox } from '../hooks/useInbox';
import { notificationDestination } from '../model/notification-destination';

const popupDuration = 9000;

export function NotificationPopups({ inbox }: { inbox: ReturnType<typeof useInbox> }) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-3 top-20 z-50 ml-auto flex max-w-sm flex-col gap-2 sm:right-5"
    >
      {inbox.popups?.map(item => (
        <NotificationPopup key={item.id} item={item} dismiss={inbox.dismissPopup} read={inbox.read} />
      ))}
    </div>
  );
}

function NotificationPopup({ item, dismiss, read }: {
  item: NotificationItem;
  dismiss: (id: number) => void;
  read: (id: number) => Promise<boolean>;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (hovered || focused) return;
    let timeout: number | undefined;
    function scheduleDismissal() {
      window.clearTimeout(timeout);
      if (!document.hidden) timeout = window.setTimeout(() => dismiss(item.id), popupDuration);
    }
    scheduleDismissal();
    document.addEventListener('visibilitychange', scheduleDismissal);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', scheduleDismissal);
    };
  }, [dismiss, focused, hovered, item.id]);

  function open() {
    void read(item.id);
    dismiss(item.id);
    navigateTo(notificationDestination(item) ?? '/notifications');
  }

  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-ink shadow-lg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-tint text-accent">
        <Icon name="bell" />
      </span>
      <button
        type="button"
        onClick={open}
        className="min-w-0 flex-1 rounded text-left focus-visible:outline-2 focus-visible:outline-accent"
      >
        <strong className="block wrap-anywhere text-sm hover:text-accent">{item.title}</strong>
        <span className="mt-1 line-clamp-2 wrap-anywhere text-xs text-muted">{item.body}</span>
      </button>
      <button
        type="button"
        aria-label="Đóng popup thông báo"
        onClick={() => dismiss(item.id)}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
