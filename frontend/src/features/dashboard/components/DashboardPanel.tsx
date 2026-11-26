import type { ReactNode } from 'react';

type DashboardPanelProps = {
  id?: string;
  title: string;
  description: string;
  viewAllHref: string;
  children: ReactNode;
};

// Card shell shared by the dashboard list sections.
export function DashboardPanel({ id, title, description, viewAllHref, children }: DashboardPanelProps) {
  return (
    <section id={id} className="scroll-mt-20 min-w-0 flex flex-col rounded-2xl border border-line bg-surface shadow-panel">
      <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <a
          href={viewAllHref}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-tint focus-visible:outline-2 focus-visible:outline-accent"
        >
          Xem tất cả
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
        </a>
      </header>
      <div className="mx-5 border-t border-line" />
      {children}
    </section>
  );
}
