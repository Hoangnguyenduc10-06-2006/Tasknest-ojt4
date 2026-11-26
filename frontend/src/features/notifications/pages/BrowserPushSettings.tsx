import { useEffect, useState } from 'react';
import { authenticatedAccessToken } from '../../auth';
import { requestJson } from '../../../shared/api/client';
import { Button } from '../../../shared/ui/Button';

type Preferences = { work: boolean; collaboration: boolean; messages: boolean; details: boolean };
type Settings = { publicKey: string | null; preferences: Preferences | null };
const defaults: Preferences = { work: true, collaboration: true, messages: true, details: false };
const worker = '/tasknest-push.js';
const endpoint = '/api/notifications/inbox/push';

function supported() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function request<T>(userId: string, suffix: string, method: 'POST' | 'PUT' | 'DELETE', body: unknown) {
  return requestJson<T>(endpoint + suffix, { accessToken: await authenticatedAccessToken(userId), method, body });
}

async function activeWorker() {
  const registration = await navigator.serviceWorker.register(worker);
  if (registration.active) return registration;
  const installing = registration.installing ?? registration.waiting;
  if (!installing) return registration;
  await new Promise<void>((resolve, reject) => {
    function changed() {
      if (installing?.state === 'activated') {
        installing.removeEventListener('statechange', changed);
        resolve();
      }
      if (installing?.state === 'redundant') {
        installing.removeEventListener('statechange', changed);
        reject(new Error('Không thể khởi động trình nhận thông báo.'));
      }
    }
    installing.addEventListener('statechange', changed);
    changed();
  });
  return registration;
}

export function BrowserPushSettings({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [preferences, setPreferences] = useState(defaults);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const available = supported();
  const permissionDenied = available && Notification.permission === 'denied';

  useEffect(() => {
    if (!available) return;
    let current = true;
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      const data = await request<Settings>(userId, '/settings', 'POST', { endpoint: subscription?.endpoint ?? null });
      if (current) {
        setSettings(data);
        setPreferences(data.preferences ?? defaults);
      }
    })().catch(() => { if (current) setFeedback('Không tải được cài đặt thông báo thiết bị.'); });
    return () => { current = false; };
  }, [available, userId]);

  async function save() {
    if (!settings?.publicKey) return;
    setPending(true);
    setFeedback('');
    try {
      if (await Notification.requestPermission() !== 'granted') {
        setFeedback('Hãy cho phép thông báo TaskNest trong cài đặt của trình duyệt.');
        return;
      }
      const registration = await activeWorker();
      const key = settings.publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const applicationServerKey = Uint8Array.from(atob(key), character => character.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ??
        await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const keys = subscription.toJSON().keys;
      await request(userId, '', 'PUT', { endpoint: subscription.endpoint, p256dh: keys?.p256dh, auth: keys?.auth, preferences });
      setSettings({ ...settings, preferences });
      setFeedback('Đã lưu thông báo cho thiết bị này.');
    } catch {
      setFeedback('Không thể bật thông báo trên thiết bị này. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  async function testNotification() {
    setFeedback('');
    try {
      if (Notification.permission !== 'granted') {
        setFeedback('Hãy cấp quyền thông báo cho TaskNest trong trình duyệt trước.');
        return;
      }
      const registration = await activeWorker();
      await registration.showNotification('TaskNest · Thông báo thử', {
        body: 'Thiết bị này có thể hiển thị thông báo TaskNest.',
        icon: '/brand/mark.png',
        tag: 'tasknest-device-test',
        data: { path: '/notifications' },
      });
      setFeedback('Đã yêu cầu hiển thị thông báo thử. Nếu chưa thấy, hãy kiểm tra quyền thông báo của trình duyệt trong cài đặt hệ điều hành và chế độ Tập trung.');
    } catch {
      setFeedback('Không thể hiển thị thông báo thử trên thiết bị này.');
    }
  }

  async function unsubscribe() {
    setPending(true);
    setFeedback('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await request(userId, '', 'DELETE', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      if (settings) setSettings({ ...settings, preferences: null });
      setFeedback('Đã tắt thông báo trên thiết bị này.');
    } catch {
      setFeedback('Không thể tắt thông báo. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="rounded-xl border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Thông báo trên thiết bị{permissionDenied ? ' · Bị chặn' : settings?.preferences ? ' · Đang bật' : ''}
      </summary>
      {!available ? <p className="mt-3 text-sm text-muted">Trình duyệt này chưa hỗ trợ thông báo đẩy.</p> :
        settings?.publicKey ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">Nhận thông báo của TaskNest trên thiết bị, kể cả khi đã đóng tab.</p>
            {permissionDenied && <p role="status" className="text-sm text-danger">Trình duyệt đang chặn thông báo. Hãy cho phép thông báo cho trang TaskNest rồi tải lại trang.</p>}
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {(Object.entries({
                work: 'Giao việc, nhắc tên và phản hồi',
                collaboration: 'Lời mời, đề xuất và bàn giao',
                messages: 'Tin nhắn riêng, đội và dự án',
                details: 'Hiển thị nội dung trên thiết bị',
              }) as [keyof Preferences, string][]).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" disabled={pending} checked={preferences[key]} onChange={event =>
                    setPreferences(previous => ({ ...previous, [key]: event.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button loading={pending} disabled={permissionDenied} onClick={() => void save()}>
                {settings.preferences ? 'Lưu tùy chọn' : 'Bật thông báo'}
              </Button>
              {settings.preferences && !permissionDenied && <Button kind="secondary" disabled={pending} onClick={() => void testNotification()}>Thử thông báo thiết bị</Button>}
              {settings.preferences && <Button kind="secondary" disabled={pending} onClick={() => void unsubscribe()}>
                Tắt trên thiết bị này
              </Button>}
            </div>
          </div>
        ) : settings && <p className="mt-3 text-sm text-muted">Thông báo đẩy chưa được bật trên máy chủ.</p>}
      {feedback && <p role="status" className="mt-3 text-sm text-muted">{feedback}</p>}
    </details>
  );
}
