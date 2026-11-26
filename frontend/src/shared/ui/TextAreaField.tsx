import { useId, type TextareaHTMLAttributes } from 'react';

export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextAreaField({
  label,
  error,
  hint,
  id,
  className = '',
  rows = 4,
  ...props
}: TextAreaFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const description = [
    props['aria-describedby'],
    error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div>
      <label
        htmlFor={inputId}
        className="mb-2 block text-[11px] font-semibold text-ink"
      >
        {label}
      </label>
      <textarea
        {...props}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={description}
        className={`w-full rounded-lg border bg-field px-[11px] py-2.5 text-xs text-ink outline-none transition placeholder:text-muted focus:ring-2 disabled:opacity-60 ${
          error
            ? 'border-danger focus:ring-danger/20'
            : 'border-line focus:border-accent focus:ring-accent/20'
        } ${className}`}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs leading-5 text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs leading-5 text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
