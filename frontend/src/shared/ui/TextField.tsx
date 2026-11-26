import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

export type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
};

export function TextField({ label, error, hint, trailing, id, className = '', ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const description = [props['aria-describedby'], error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-[11px] font-semibold text-ink">{label}</label>
      <div className="relative">
        <input {...props} id={inputId} aria-invalid={error ? true : undefined} aria-describedby={description}
          className={`min-h-[42px] w-full rounded-lg border bg-field px-[11px] py-2.5 text-xs text-ink outline-none transition placeholder:text-muted focus:ring-2 disabled:opacity-60 ${error ? 'border-danger focus:ring-danger/20' : 'border-line focus:border-accent focus:ring-accent/20'} ${trailing ? 'pr-20' : ''} ${className}`} />
        {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
      </div>
      {error ? <p id={`${inputId}-error`} className="mt-1.5 text-xs leading-5 text-danger">{error}</p>
        : hint && <p id={`${inputId}-hint`} className="mt-1.5 text-xs leading-5 text-muted">{hint}</p>}
    </div>
  );
}
