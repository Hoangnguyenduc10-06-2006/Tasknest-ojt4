import type { HTMLAttributes } from 'react';
export function Panel({className='',...props}:HTMLAttributes<HTMLElement>){return <section {...props} className={`panel figma-panel min-w-0 border border-line bg-surface p-5 shadow-panel ${className}`}/>;}
