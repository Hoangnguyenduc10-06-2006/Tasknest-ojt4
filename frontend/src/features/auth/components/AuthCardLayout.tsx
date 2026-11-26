import { BrandLogo } from '../../../shared/ui/BrandLogo';
import type { ReactNode } from 'react';
import { ThemeSwitcher } from '../../../shared/theme/ThemeSwitcher';
import { useTheme } from '../../../shared/theme/useTheme';

export function AuthCardLayout({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-canvas text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute -left-72 top-20 -z-10 size-[450px] rounded-full border border-accent/15" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-52 -z-10 size-[500px] rounded-full border border-accent/15" />
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <a href="/" className="flex items-center gap-2.5 text-xl font-bold tracking-tight"><BrandLogo /></a>
        <ThemeSwitcher value={theme} onChange={setTheme} />
      </header>
      <main className="relative mx-auto flex w-full max-w-lg flex-1 items-center px-6 py-12 sm:py-16">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 hidden size-[580px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/15 sm:block" />
        <div className="auth-card w-full rounded-2xl border border-line bg-surface p-6 shadow-auth-card sm:p-8">{children}</div>
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-3 px-6 py-6 text-xs text-muted"><span>TaskNest · Quản lý công việc và dự án</span><a href="/" className="hover:text-accent">Về trang giới thiệu</a></footer>
    </div>
  );
}
