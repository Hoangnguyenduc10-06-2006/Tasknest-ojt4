import type { ReactNode } from 'react';

export function Tabs<T extends string>({ items, value, onChange, idPrefix, label = 'Nội dung' }: {
  items: Array<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  idPrefix?: string;
  label?: string;
}) {
  return <div role="tablist" aria-label={label} className="project-tabs !mt-0 overflow-x-auto">{items.map((item, index) => <button key={item.value} id={idPrefix && `${idPrefix}-tab-${item.value}`} aria-controls={idPrefix && `${idPrefix}-panel-${item.value}`} type="button" role="tab" tabIndex={value === item.value ? 0 : -1} aria-selected={value === item.value} onClick={() => onChange(item.value)} onKeyDown={(event) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    onChange(items[next].value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }} className={`motion-press shrink-0 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-semibold transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent active:opacity-80 ${value === item.value ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}>{item.label}{item.count !== undefined && <span className="ml-1.5 rounded-md bg-panel px-1.5 py-0.5 text-[10px] text-ink">{item.count}</span>}</button>)}</div>;
}
