'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = new Set<number>([1, page - 1, page, page + 1, totalPages]);
  const sorted = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);

  const rendered: Array<number | '...'> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) rendered.push('...');
    rendered.push(value);
  });

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <p className="text-xs text-[var(--text-secondary)]">
        {from}–{to} of {total}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="btn-icon disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        {rendered.map((value, index) =>
          value === '...' ? (
            <span key={`ellipsis-${index}`} className="w-8 text-center text-xs text-[var(--text-secondary)]">
              …
            </span>
          ) : (
            <button
              key={value}
              type="button"
              onClick={() => onPageChange(value)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold"
               style={
                 value === page
                   ? { background: 'var(--accent)', color: '#fff' }
                   : { color: 'var(--text-secondary)' }
               }
            >
              {value}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="btn-icon disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
