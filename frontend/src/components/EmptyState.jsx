import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, description, action, tone = 'neutral' }) {
  const IconEl = typeof Icon === 'string' ? null : Icon;
  return <div className={`empty-state empty-state--${tone}`}>
    <div className="empty-icon" aria-hidden="true">{IconEl ? <IconEl /> : Icon}</div>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {action}
  </div>;
}
