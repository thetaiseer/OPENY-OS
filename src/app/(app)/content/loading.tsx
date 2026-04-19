export default function ContentLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-28 rounded-xl" style={{ background: 'var(--surface)' }} />
          <div className="h-4 w-52 rounded-lg" style={{ background: 'var(--surface)' }} />
        </div>
        <div className="h-9 w-32 rounded-lg" style={{ background: 'var(--surface)' }} />
      </div>
      {/* Filters */}
      <div className="flex gap-3">
        <div className="h-9 w-56 rounded-lg" style={{ background: 'var(--surface)' }} />
        <div className="h-9 w-40 rounded-lg" style={{ background: 'var(--surface)' }} />
      </div>
      {/* Content cards */}
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    </div>
  );
}
