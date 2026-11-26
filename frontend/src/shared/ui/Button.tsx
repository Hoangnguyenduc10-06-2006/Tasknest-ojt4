import type { ButtonHTMLAttributes } from 'react';
import { Icon,type IconName } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'md' | 'sm';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonVariant; icon?: IconName; loading?: boolean; size?: ButtonSize; variant?: ButtonVariant };

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border border-transparent bg-accent text-on-accent hover:bg-accent-hover shadow-sm',
  ghost: 'border border-transparent text-muted hover:bg-panel hover:text-ink',
  danger: 'border border-danger/25 bg-danger-soft text-danger hover:bg-danger/15',
  secondary: 'border border-line bg-surface text-ink hover:bg-panel',
};
const sizeClasses: Record<ButtonSize, string> = {
  md: 'min-h-10 px-4 py-2.5',
  sm: 'min-h-9 px-3.5 py-2',
};

export function Button({ loading = false, size = 'md', variant = 'primary', kind, icon, disabled, children, className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={`motion-press button ${kind ?? variant} figma-button inline-flex ${sizeClasses[size]} shrink-0 items-center justify-center gap-2 rounded-xl ${variantClasses[kind??variant]} text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 ${className}`}>
      {loading && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current/40 border-t-current motion-reduce:animate-none" />}
      {icon && !loading && <Icon name={icon} />}
      {children}
    </button>
  );
}
