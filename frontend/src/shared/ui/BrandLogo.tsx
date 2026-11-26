type BrandLogoProps = { className?: string; wordmark?: boolean };

/** Shared application identity; project avatars remain independent. */
export function BrandLogo({ className = '', wordmark = false }: BrandLogoProps) {
  if (wordmark) return <span className={`relative block ${className}`}>
    <img src="/brand/wordmark.png" alt="TaskNest" className="block h-auto w-full object-contain" />
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-ink dark:hidden" style={{ maskImage: 'url(/brand/wordmark.png)', maskSize: '100% 100%', maskRepeat: 'no-repeat', clipPath: 'inset(0 0 0 31%)' }} />
  </span>;
  return <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <img src="/brand/mark.png" alt="" className="size-10 shrink-0 object-contain" />
    <span className="text-xl font-bold tracking-tight text-ink">TaskNest</span>
  </span>;
}
