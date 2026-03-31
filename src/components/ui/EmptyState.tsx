









export function EmptyState({ icon: Icon, title, description, action = null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--surface-3)' }}>
        
        <Icon size={24} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="text-xs max-w-[260px]" style={{ color: 'var(--text-muted)' }}>{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>);

}