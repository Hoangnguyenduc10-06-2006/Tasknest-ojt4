import type { ReactNode } from 'react';
import type { Theme } from './useTheme';

const modes: { value: Theme; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Sáng',
    icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
  },
  {
    value: 'dark',
    label: 'Tối',
    icon: <path d="M20.5 14.4A8.7 8.7 0 0 1 9.6 3.5a8.7 8.7 0 1 0 10.9 10.9Z" />,
  },
  {
    value: 'system',
    label: 'Theo hệ thống',
    icon: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
  },
];

export function ThemeSwitcher({ value, onChange }: { value: Theme; onChange: (theme: Theme) => void }) {
  return (
    <div role="group" aria-label="Giao diện" className="inline-flex shrink-0 items-center gap-1 rounded-2xl border border-line bg-surface p-1">
      {modes.map((mode) => (
        <button
          key={mode.value}
          type="button"
          aria-label={mode.label}
          aria-pressed={value === mode.value}
          title={mode.label}
          onClick={() => onChange(mode.value)}
          className={`inline-flex size-7 items-center justify-center rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${value === mode.value ? 'border-line bg-field text-ink shadow-sm' : 'border-transparent text-muted hover:bg-field/60 hover:text-ink'}`}
        >
          <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{mode.icon}</svg>
        </button>
      ))}
    </div>
  );
}
