export default function TeamLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-24 rounded-xl" style={{ background: 'var(--surface)' }} />
          <div className="h-4 w-56 rounded-lg" style={{ background: 'var(--surface)' }} />
        </div>
        <div className="h-9 w-36 rounded-lg" style={{ background: 'var(--surface)' }} />
      </div>
      {/* Member cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
      {/* Invitations section */}
      <div className="space-y-3">
        <div className="h-5 w-36 rounded-lg" style={{ background: 'var(--surface)' }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-14 rounded-xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    </div>
  );
}
