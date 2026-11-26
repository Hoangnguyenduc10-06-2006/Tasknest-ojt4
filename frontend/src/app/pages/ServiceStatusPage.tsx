import { BrandLogo } from '../../shared/ui/BrandLogo';
import { useEffect, useState } from 'react';
import { getJson } from '../../shared/api/client';
import { useTheme } from '../../shared/theme/useTheme';
import { ThemeSwitcher } from '../../shared/theme/ThemeSwitcher';
type Probe = { service: string; stage: string };
const services = [
  { name: 'API Gateway', path: '/api/status' },
  { name: 'Identity', path: '/api/identity/status' },
  { name: 'Work Management', path: '/api/work/status' },
  { name: 'Notification', path: '/api/notifications/status' },
];
export default function ServiceStatusPage() {
  const { theme, setTheme } = useTheme();
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    services.forEach(({ path }) => {
      getJson<Probe>(path, controller.signal).then(
        (data) => { if (!controller.signal.aborted) setChecks((old) => ({ ...old, [path]: data.stage === 'scaffold' ? 'Đã kết nối' : 'Phản hồi không hợp lệ' })); },
        () => { if (!controller.signal.aborted) setChecks((old) => ({ ...old, [path]: 'Chưa kết nối được' })); },
      );
    });
    return () => controller.abort();
  }, [attempt]);
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <a href="/" className="text-xl font-bold tracking-tight"><BrandLogo /></a>
          <ThemeSwitcher value={theme} onChange={setTheme} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Môi trường phát triển</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight">Không gian làm việc của nhóm bắt đầu từ đây.</h1>
        <p className="mt-5 max-w-2xl leading-7 text-muted">Bộ khung TaskNest đã sẵn sàng để phát triển. Các màn hình tài khoản, dự án và công việc sẽ được bổ sung theo SRS.</p>
        <section aria-labelledby="connection-title" className="mt-10 rounded-2xl border border-line bg-field p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="connection-title" className="text-lg font-semibold">Kết nối dịch vụ</h2>
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover" onClick={() => { setChecks({}); setAttempt((value) => value + 1); }}>Kiểm tra lại</button>
          </div>
          <ul aria-live="polite" className="mt-4 divide-y divide-line">
            {services.map(({ name, path }) => <li key={path} className="flex flex-wrap justify-between gap-2 py-4"><span>{name}</span><span className="text-sm text-muted">{checks[path] ?? 'Đang kiểm tra…'}</span></li>)}
          </ul>
          <p className="mt-4 text-sm leading-6 text-muted">Kiểm tra này chỉ xác nhận endpoint trạng thái qua Gateway. Chức năng nghiệp vụ và xác thực chưa được triển khai.</p>
        </section>
      </main>
    </div>
  );
}
