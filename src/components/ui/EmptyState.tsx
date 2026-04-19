import { ReactNode } from 'react';
import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  /** Short headline */
  title?: string;
  /** Longer descriptive message */
  message?: string;
  /** Optional icon override (defaults to InboxIcon) */
  icon?: ReactNode;
  /** Optional CTA rendered below the message */
  action?: ReactNode;
}

/**
 * EmptyState — shown when a list or surface has no content.
 * Navy-direction design: subtle blue-tinted container, brand-accent icon badge.
 */
export function EmptyState({
  title = 'Nothing here yet',
  message = 'This area will populate once data is available.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <div className="ui-empty-icon">
        {icon ?? <InboxIcon size={22} />}
      </div>
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
