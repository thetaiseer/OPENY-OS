export default function ClientsLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-48 rounded-xl" style={{ background: 'var(--surface)' }} />
      <div className="h-10 rounded-xl" style={{ background: 'var(--surface)' }} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    </div>
  );
}
