// Skeleton loader components — prevent layout shift during data fetching.

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`openy-skeleton rounded-2xl border ${className}`}
      style={{
        background: 'var(--surface-glass)',
        borderColor: 'var(--border-glass)',
        boxShadow: 'var(--shadow-xs)',
        height: 120,
      }}
    />
  );
}

export function SkeletonLine({
  width = 'w-full',
  height = 'h-4',
}: {
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={`openy-skeleton rounded-lg ${width} ${height}`}
      style={{ background: 'var(--surface-2)' }}
    />
  );
}

export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div
      className="flex items-center gap-4 border-b px-6 py-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <div
        className="openy-skeleton h-9 w-9 shrink-0 rounded-2xl"
        style={{ background: 'var(--surface-2)' }}
      />
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <div
          key={i}
          className="openy-skeleton h-4 flex-1 rounded-lg"
          style={{ background: 'var(--surface-2)', maxWidth: i === 0 ? 200 : 120 }}
        />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: 'var(--border-glass)',
        background: 'var(--surface-glass)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </div>
  );
}

export function SkeletonStatGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
