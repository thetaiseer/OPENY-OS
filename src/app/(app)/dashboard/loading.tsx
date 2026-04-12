export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
      {/* charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 rounded-2xl" style={{ background: 'var(--surface)' }} />
        <div className="h-48 rounded-2xl" style={{ background: 'var(--surface)' }} />
      </div>
      {/* bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    </div>
  );
}
