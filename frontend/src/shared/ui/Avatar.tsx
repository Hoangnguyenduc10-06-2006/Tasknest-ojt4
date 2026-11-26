import type { BadgeTone } from './Badge';
const colors:Record<BadgeTone,string>={blue:'bg-tint text-accent',green:'bg-success-soft text-success',amber:'bg-warning-soft text-warning',purple:'bg-review-soft text-review',neutral:'bg-panel text-muted',red:'bg-danger-soft text-danger'};
export function Avatar({name,tone='blue',className='',src}:{name:string;tone?:BadgeTone;className?:string;src?:string}){
 const initials=name.trim().split(/\s+/).filter(Boolean).slice(-2).map(word=>word[0]).join('').toUpperCase();
 return <span title={name} aria-label={name} className={`avatar inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-surface ${colors[tone]} ${className}`}>{src ? <img src={src} alt="" className="size-full rounded-full object-cover" /> : initials||'?'}</span>;
}
