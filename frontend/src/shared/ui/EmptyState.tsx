import type { ReactNode } from 'react';
import { Panel } from './Panel';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Panel className="flex min-h-48 flex-col items-center justify-center !border-dashed !bg-panel p-6 text-center !shadow-none">
      <h2 className="max-w-full break-words text-base font-semibold text-ink">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-4 max-w-full">{action}</div>}
    </Panel>
  );
}
