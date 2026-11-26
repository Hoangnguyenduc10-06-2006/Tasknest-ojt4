import { BrandLogo } from '../../../shared/ui/BrandLogo';
export function AuthIntroPanel() {
  return (
    <aside className="relative isolate hidden flex-col overflow-hidden bg-panel px-12 py-10 text-ink lg:flex xl:px-16">
          <div aria-hidden="true" className="pointer-events-none absolute -left-52 top-24 -z-10 size-[550px] rounded-full border border-accent/15" />
          <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-48 -z-10 size-[360px] rounded-full border border-accent/15" />
          <a href="/" className="flex w-fit items-center gap-3 text-xl font-semibold tracking-tight"><BrandLogo /></a>
          <div className="my-auto max-w-md py-16">
            <p className="mb-6 text-xs font-medium uppercase tracking-[0.24em] text-accent">Không gian làm việc của nhóm</p>
            <h1 className="text-4xl font-semibold leading-[1.2] tracking-tight xl:text-5xl">Cùng một mục tiêu.<br /><span className="text-accent">Cùng một nơi làm việc.</span></h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-muted">Từ ý tưởng đầu tiên đến công việc hoàn thành, kết nối nhóm của bạn trên TaskNest.</p>
          </div>
          <p className="text-xs text-muted">© 2026 TaskNest</p>
        </aside>
  );
}
