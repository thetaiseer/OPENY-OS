export default function ReportsLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="h-7 w-24 rounded-xl" style={{ background: 'var(--surface)' }} />
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-72 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
      <div className="h-64 rounded-2xl" style={{ background: 'var(--surface)' }} />
    </div>
  );
}
