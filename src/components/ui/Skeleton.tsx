export function SkeletonCard({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-2xl border ${className}`} style={{ borderColor: 'var(--border)', minHeight: 120 }} />;
}

export function SkeletonLine({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`skeleton-shimmer rounded-lg ${width} ${height}`} />;
}

const FIRST_COL_MAX_WIDTH = 220;
const OTHER_COL_MAX_WIDTH = 140;

export function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
      <div className="skeleton-shimmer h-9 w-9 shrink-0 rounded-xl" />
      {Array.from({ length: cols - 1 }).map((_, index) => (
        <div key={index} className="skeleton-shimmer h-4 flex-1 rounded-lg" style={{ maxWidth: index === 0 ? FIRST_COL_MAX_WIDTH : OTHER_COL_MAX_WIDTH }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonTableRow key={index} cols={cols} />
      ))}
    </div>
  );
}

export function SkeletonStatGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 md:gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}
