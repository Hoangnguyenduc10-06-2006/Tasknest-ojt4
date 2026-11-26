import { Badge, type BadgeTone } from './Badge';

const roles: Record<string, { label: string; tone: BadgeTone }> = {
  owner: { label: 'Owner', tone: 'purple' },
  manager: { label: 'Manager', tone: 'green' },
  customer: { label: 'Khách hàng', tone: 'neutral' },
  member: { label: 'Member', tone: 'blue' },
};

/** Accepts role casing from both REST responses and frontend models. */
export function RoleBadge({ role, prefix = '', className = '', label }: { role: string; prefix?: string; className?: string; label?: string }) {
  const config = roles[role.trim().toLowerCase()];
  return <Badge tone={config?.tone ?? 'neutral'} className={className}>{prefix}{label ?? config?.label ?? role}</Badge>;
}
