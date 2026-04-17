'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Users2, CheckSquare, FolderOpen, FileText, Users,
  X, Clock, ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultType = 'client' | 'task' | 'asset' | 'content' | 'team';

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENT_KEY = 'openy_recent_searches';
const MAX_RECENT = 8;

const TYPE_META: Record<ResultType, { label: string; icon: LucideIcon }> = {
  client:  { label: 'Client',  icon: Users2 },
  task:    { label: 'Task',    icon: CheckSquare },
  asset:   { label: 'Asset',   icon: FolderOpen },
  content: { label: 'Content', icon: FileText },
  team:    { label: 'Team',    icon: Users },
};

const TYPE_ORDER: ResultType[] = ['client', 'task', 'content', 'asset', 'team'];

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function addRecentSearch(q: string) {
  const list = [q, ...getRecentSearches().filter(s => s !== q)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_KEY);
}

// ─── Badge colour per type ────────────────────────────────────────────────────

function typeBadgeStyle(type: ResultType): React.CSSProperties {
  const map: Record<ResultType, { bg: string; color: string }> = {
    client:  { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
    task:    { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    asset:   { bg: 'rgba(234,179,8,0.12)',  color: '#ca8a04' },
    content: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
    team:    { bg: 'rgba(34,197,94,0.12)',  color: '#16a34a' },
  };
  return { background: map[type].bg, color: map[type].color };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  /** When true the input is shown in "activated" mode (used by CMD+K flow). */
  open?: boolean;
  onClose?: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps = {}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = focused || !!open;

  // Load recent searches when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
    }
  }, [isOpen]);

  // Focus input when `open` prop activates
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setActiveIdx(-1);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
        if (res.ok) {
          const data: SearchResponse = await res.json();
          setResults(data.results ?? []);
        }
      } finally {
        setLoading(false);
        setActiveIdx(-1);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    setFocused(false);
    setQuery('');
    setResults([]);
    setActiveIdx(-1);
    onClose?.();
  }, [onClose]);

  // Flat list of navigable items
  const flatItems: SearchResult[] = results;
  const showRecents = !query.trim() && recentSearches.length > 0;

  function navigate(href: string, title: string) {
    addRecentSearch(title);
    setRecentSearches(getRecentSearches());
    router.push(href);
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && flatItems[activeIdx]) {
        const item = flatItems[activeIdx];
        navigate(item.href, item.title);
      } else if (query.trim()) {
        // Navigate to first result if any
        if (flatItems.length > 0) navigate(flatItems[0].href, flatItems[0].title);
      }
    }
  }

  // Group results by type, preserving TYPE_ORDER
  const grouped = TYPE_ORDER.reduce<Record<string, SearchResult[]>>((acc, t) => {
    const items = results.filter(r => r.type === t);
    if (items.length) acc[t] = items;
    return acc;
  }, {});
  const hasResults = results.length > 0;

  return (
    <div className="relative w-full max-w-sm">
      {/* Input */}
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-secondary)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search… (⌘K)"
          className="topbar-search-input w-full h-9 pl-9 pr-8 rounded-xl text-sm outline-none"
          style={{
            color: 'var(--text)',
          }}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropRef}
          className="absolute top-full mt-2 left-0 right-0 rounded-2xl shadow-2xl border overflow-hidden z-[300] animate-openy-slide-down"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            minWidth: 320,
          }}
        >
          {/* Loading */}
          {loading && (
            <div className="px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Searching…</span>
            </div>
          )}

          {/* Recent searches */}
          {!loading && showRecents && (
            <div>
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Recent
                </span>
                <button
                  onClick={() => { clearRecentSearches(); setRecentSearches([]); }}
                  className="text-[11px] hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Clear
                </button>
              </div>
              {recentSearches.map(s => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[var(--surface-2)] transition-colors"
                >
                  <Clock size={13} style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{s}</span>
                </button>
              ))}
            </div>
          )}

          {/* No query, no recents */}
          {!loading && !query.trim() && recentSearches.length === 0 && (
            <div className="px-4 py-4 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Type to search across clients, tasks, assets, and more…</p>
            </div>
          )}

          {/* Results grouped by type */}
          {!loading && hasResults && (
            <div className="py-1 max-h-96 overflow-y-auto">
              {(Object.entries(grouped) as [ResultType, SearchResult[]][]).map(([type, items]) => {
                const { label, icon: TypeIcon } = TYPE_META[type];
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                      <TypeIcon size={12} style={{ color: 'var(--text-secondary)' }} />
                      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                        {label}
                      </span>
                    </div>
                    {items.map(item => {
                      const globalIdx = flatItems.indexOf(item);
                      const active = globalIdx === activeIdx;
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.href, item.title)}
                          onMouseEnter={() => setActiveIdx(globalIdx)}
                          className={clsx(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            active ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-2)]',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.badge && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wide"
                                style={typeBadgeStyle(type)}
                              >
                                {item.badge.replace(/_/g, ' ')}
                              </span>
                            )}
                            <ArrowRight size={12} style={{ color: 'var(--text-secondary)', opacity: active ? 1 : 0 }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* No results */}
          {!loading && query.trim() && !hasResults && (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Try a different search term</p>
            </div>
          )}

          {/* Footer hint */}
          {hasResults && (
            <div
              className="px-4 py-2 border-t flex items-center gap-3 text-[11px]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              <span><kbd className="font-mono bg-[var(--surface-2)] px-1 py-0.5 rounded text-[10px]">↑↓</kbd> Navigate</span>
              <span><kbd className="font-mono bg-[var(--surface-2)] px-1 py-0.5 rounded text-[10px]">↵</kbd> Open</span>
              <span><kbd className="font-mono bg-[var(--surface-2)] px-1 py-0.5 rounded text-[10px]">Esc</kbd> Close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
