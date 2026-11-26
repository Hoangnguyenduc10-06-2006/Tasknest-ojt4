import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { areaHref } from '../../app/router/location';
import { Icon } from '../../shared/ui/Icon';

export type ChatTarget =
  | { kind: 'user'; id: string }
  | { kind: 'team'; id: number | string }
  | { kind: 'project'; id: number | string };

type ChatLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  destination: ChatTarget;
  children: ReactNode;
  iconOnly?: boolean;
};

function targetPath(target: ChatTarget) {
  const key = target.kind === 'user' ? 'user' : target.kind;
  return '/messages?' + key + '=' + encodeURIComponent(String(target.id));
}

/** A shared entry point to direct, team, and project conversations. */
export function ChatLink({
  destination,
  children,
  iconOnly = false,
  className = '',
  ...props
}: ChatLinkProps) {
  return (
    <a
      href={areaHref(targetPath(destination))}
      className={
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-accent/15 bg-tint px-3.5 py-2 text-xs font-semibold text-accent shadow-sm shadow-accent/5 transition hover:border-accent/30 hover:bg-accent/10 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
        className
      }
      {...props}
    >
      <Icon name="message" size={16} />
      {!iconOnly && children}
      {iconOnly && <span className="sr-only">{children}</span>}
    </a>
  );
}
