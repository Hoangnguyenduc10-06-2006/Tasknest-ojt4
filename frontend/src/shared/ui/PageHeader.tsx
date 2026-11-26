import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, actions, titleId }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; titleId?: string }) {
  return (
    <header className="page-title figma-page-title flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="page-eyebrow text-xs font-bold tracking-wider text-accent">{eyebrow}</p>}
        <h1 id={titleId} className="mt-2 break-words text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="page-description mt-2 text-sm leading-6 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
