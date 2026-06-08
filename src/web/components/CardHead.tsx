import type { LucideIcon } from 'lucide-react';

export type CardHeadTone = 'violet' | 'teal' | 'gold' | 'danger' | 'muted';

export function CardHead({
  icon: Icon,
  tone = 'violet',
  title,
  subtitle,
}: {
  icon: LucideIcon;
  tone?: CardHeadTone;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="card-head">
      <span className={`icon-badge ${tone}`}>
        <Icon size={18} />
      </span>
      <div className="card-head-body">
        <h2 className="h2">{title}</h2>
        {subtitle && (
          <p className="copy" style={{ marginTop: 2 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
