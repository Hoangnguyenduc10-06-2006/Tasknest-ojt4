import type { HTMLAttributes } from 'react';
export type BadgeTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'purple';
const colors:Record<BadgeTone,string>={neutral:'bg-panel text-muted',blue:'bg-tint text-accent',green:'bg-success-soft text-success',amber:'bg-warning-soft text-warning',red:'bg-danger-soft text-danger',purple:'bg-review-soft text-review'};
/** Shared visual primitive; feature components supply business labels and tones. */
export function Badge({tone='neutral',className='',children,...props}:HTMLAttributes<HTMLSpanElement>&{tone?:BadgeTone}){
  return <span {...props} className={`badge inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold leading-none whitespace-nowrap ${colors[tone]} ${className}`}>{children}</span>;
}
