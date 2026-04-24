export default function AppSegmentLoading() {
  return (
    <div className="animate-pulse space-y-6 p-4 md:p-6">
      <div className="h-9 w-56 max-w-full rounded-xl" style={{ background: 'var(--surface)' }} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-32 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
      <div className="h-72 rounded-2xl" style={{ background: 'var(--surface)' }} />
    </div>
  );
}
