// Skeleton loader components — prevent layout shift during data fetching.

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border skeleton-shimmer ${className}`}
      style={{ borderColor: 'var(--border)', minHeight: 120 }}
    />
  );
}

export function SkeletonLine({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) {
  return (
    <div className={`rounded-lg skeleton-shimmer ${width} ${height}`} />
  );
}

export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="w-9 h-9 rounded-xl skeleton-shimmer shrink-0" />
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-lg skeleton-shimmer flex-1"
          style={{ maxWidth: i === 0 ? 200 : 120 }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </div>
  );
}

export function SkeletonStatGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
