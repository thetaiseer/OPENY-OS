export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
      {/* charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-48 rounded-2xl" style={{ background: 'var(--surface)' }} />
        <div className="h-48 rounded-2xl" style={{ background: 'var(--surface)' }} />
      </div>
      {/* bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    </div>
  );
}
