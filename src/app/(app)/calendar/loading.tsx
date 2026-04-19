export default function CalendarLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded-xl" style={{ background: 'var(--surface)' }} />
          <div className="h-4 w-64 rounded-lg" style={{ background: 'var(--surface)' }} />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg" style={{ background: 'var(--surface)' }} />
          <div className="h-5 w-36 rounded-lg" style={{ background: 'var(--surface)' }} />
          <div className="h-9 w-9 rounded-lg" style={{ background: 'var(--surface)' }} />
        </div>
      </div>
      {/* Legend */}
      <div className="flex gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-4 w-28 rounded-lg" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
      {/* Calendar grid + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-10 border-r last:border-0" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }} />
            ))}
          </div>
          <div className="grid grid-cols-7">
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-24 border-r border-b" style={{ borderColor: 'var(--border)' }} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-6 w-40 rounded-lg" style={{ background: 'var(--surface)' }} />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
