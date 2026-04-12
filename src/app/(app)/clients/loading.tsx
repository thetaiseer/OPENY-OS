export default function ClientsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-48 rounded-xl" style={{ background: 'var(--surface)' }} />
      <div className="h-10 rounded-xl" style={{ background: 'var(--surface)' }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    </div>
  );
}
