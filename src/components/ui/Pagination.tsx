'use client';

import React from 'react';
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
  const to   = Math.min(page * pageSize, total);

  // Build page list — always show first, last, current ± 1
  const pages: (number | '...')[] = [];
  const add = (n: number) => {
    if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n);
  };
  add(1);
  add(page - 1);
  add(page);
  add(page + 1);
  add(totalPages);

  const sorted = [...new Set(pages.filter(p => typeof p === 'number'))] as number[];
  sorted.sort((a, b) => a - b);

  const withEllipsis: (number | '...')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) withEllipsis.push('...');
    withEllipsis.push(sorted[i]);
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronLeft size={15} />
        </button>

        {withEllipsis.map((p, i) =>
          p === '...' ? (
            <span key={`e-${i}`} className="w-8 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-colors"
              style={
                p === page
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
