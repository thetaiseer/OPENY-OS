export default function AssetsLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-48 rounded-xl" style={{ background: 'var(--surface)' }} />
      <div className="h-10 rounded-xl" style={{ background: 'var(--surface)' }} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl"
            style={{ background: 'var(--surface)' }}
          />
        ))}
      </div>
    </div>
  );
}
