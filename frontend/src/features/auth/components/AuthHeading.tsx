import { BrandLogo } from '../../../shared/ui/BrandLogo';
import { Icon, type IconName } from '../../../shared/ui/Icon';

export function AuthHeading({ title, eyebrow, description, icon, brand = false }: {
  title: string;
  eyebrow?: string;
  description?: string;
  icon?: IconName;
  brand?: boolean;
}) {
  return (
    <div className="auth-heading text-center">
      {brand ? <div className="mb-5 flex justify-center"><BrandLogo /></div> : icon && <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-tint text-accent"><Icon name={icon} size={24} /></span>}
      {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-accent">{eyebrow}</p>}
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      {description && <p className="mt-3 text-sm leading-6 text-muted">{description}</p>}
    </div>
  );
}
