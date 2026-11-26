import { BrandLogo } from '../../../shared/ui/BrandLogo';
import { ThemeSwitcher } from '../../../shared/theme/ThemeSwitcher';
import { useTheme } from '../../../shared/theme/useTheme';
import { AuthIntroPanel } from '../components/AuthIntroPanel';

export function WelcomePage() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid min-h-screen bg-canvas text-ink lg:grid-cols-[0.95fr_1.05fr]">
      <AuthIntroPanel />
      <main className="flex min-w-0 flex-col px-6 py-7 sm:px-12 lg:px-14">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="text-lg font-bold text-accent lg:invisible"><BrandLogo /></a>
          <ThemeSwitcher value={theme} onChange={setTheme} />
        </header>
        <div className="mx-auto my-auto w-full max-w-[420px] py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Chào mừng đến với TaskNest</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight">Công việc rõ ràng.<br />Cả nhóm cùng tiến.</h2>
          <p className="mt-5 text-base leading-7 text-muted">Quản lý dự án, theo dõi tiến độ và kết nối các thành viên trong một không gian chung.</p>
          <a href="/login" className="mt-9 flex min-h-12 items-center justify-center gap-3 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-on-accent transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Bắt đầu ngay <span aria-hidden="true">→</span></a>
          <a href="/teams" className="mt-3 flex min-h-12 items-center justify-center rounded-xl border border-line px-5 py-3 text-sm font-semibold text-accent hover:bg-panel">Khám phá đội phát triển</a>
          <p className="mt-5 text-center text-sm text-muted">Chưa có tài khoản? <a href="/register" className="font-semibold text-accent hover:underline">Đăng ký miễn phí</a></p>
        </div>
        <footer className="text-center text-xs text-muted">TaskNest · Quản lý công việc và dự án</footer>
      </main>
    </div>
  );
}
