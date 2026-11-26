import { Icon, type IconName } from '../../shared/ui/Icon';

type DiscoverySection = 'feed' | 'requests' | 'teams' | 'opportunities';

const sections: {
  id: DiscoverySection;
  href: string;
  label: string;
  icon: IconName;
}[] = [
  { id: 'feed', href: '/discovery', label: 'Bảng tin', icon: 'list' },
  {
    id: 'requests',
    href: '/requests',
    label: 'Tìm dự án',
    icon: 'search',
  },
  {
    id: 'teams',
    href: '/teams',
    label: 'Tìm đội',
    icon: 'users',
  },
  {
    id: 'opportunities',
    href: '/teams?view=recruiting',
    label: 'Tìm vị trí',
    icon: 'plus',
  },
];

function activeSection(pathname: string, search: string): DiscoverySection {
  if (pathname === '/discovery') return 'feed';
  if (pathname === '/requests' || pathname.startsWith('/requests/'))
    return 'requests';
  if (
    pathname === '/teams' &&
    ['recruiting', 'applications'].includes(
      new URLSearchParams(search).get('view') ?? '',
    )
  )
    return 'opportunities';
  return 'teams';
}

export function DiscoveryNavigation({
  pathname,
  search,
}: {
  pathname: string;
  search: string;
}) {
  const active = activeSection(pathname, search);
  return (
    <nav
      aria-label="Khám phá dự án và đội phát triển"
      className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-panel p-1 lg:hidden"
    >
      {sections.map((section) => {
        const selected = section.id === active;
        return (
          <a
            key={section.id}
            href={section.href}
            aria-current={selected ? 'page' : undefined}
            className={
              'group flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition sm:flex-row sm:justify-center ' +
              (selected
                ? 'bg-surface text-accent shadow-sm ring-1 ring-line'
                : 'text-muted hover:bg-surface hover:text-ink')
            }
          >
            <span
              className={
                'flex size-8 shrink-0 items-center justify-center rounded-lg ' +
                (selected ? 'bg-tint text-accent' : 'bg-surface text-muted group-hover:text-accent')
              }
            >
              <Icon name={section.icon} size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold sm:text-sm">
                {section.label}
              </span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}
