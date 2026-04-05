'use client';

/**
 * AiImproveButton — a small reusable AI writing enhancement button.
 *
 * Place next to any text input or textarea.  When clicked it sends the
 * current text to /api/ai/improve and passes the result back via
 * onImproved().
 *
 * Usage:
 *   <AiImproveButton value={text} onImproved={v => setText(v)} />
 *
 * The hook version is also exported for cases where custom trigger UI is needed:
 *   const { improve, improving } = useAiImprove();
 */

import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImproveAction = 'improve' | 'professional' | 'shorten' | 'expand';

const ACTION_LABELS: Record<ImproveAction, string> = {
  improve:      'Improve writing',
  professional: 'Make professional',
  shorten:      'Shorten',
  expand:       'Expand',
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAiImprove() {
  const [improving, setImproving] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const improve = async (text: string, action: ImproveAction = 'improve'): Promise<string | null> => {
    if (!text.trim()) return null;
    setImproving(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/improve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text, action }),
      });
      const json = await res.json() as { success: boolean; improved?: string; error?: string };
      if (!json.success) {
        setError(json.error ?? 'AI improvement failed');
        return null;
      }
      return json.improved ?? null;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
      return null;
    } finally {
      setImproving(false);
    }
  };

  return { improve, improving, error, clearError: () => setError(null) };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AiImproveButtonProps {
  /** Current text to improve */
  value: string;
  /** Called with the improved text */
  onImproved: (improved: string) => void;
  /** Show full action menu instead of single button (default: false) */
  showMenu?: boolean;
  /** Extra class names for the button */
  className?: string;
}

export default function AiImproveButton({
  value,
  onImproved,
  showMenu = false,
  className = '',
}: AiImproveButtonProps) {
  const { improve, improving, error, clearError } = useAiImprove();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAction = async (action: ImproveAction) => {
    setMenuOpen(false);
    const result = await improve(value, action);
    if (result) onImproved(result);
  };

  const disabled = improving || !value.trim();

  if (showMenu) {
    return (
      <div className="relative inline-flex items-center">
        {/* Main button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('improve')}
          title="AI: Improve writing"
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-l-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80 ${className}`}
          style={{
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRight: 'none',
          }}
        >
          {improving
            ? <Loader2 size={12} className="animate-spin" />
            : <Sparkles size={12} />
          }
          AI Improve
        </button>

        {/* Dropdown chevron */}
        <button
          type="button"
          disabled={improving}
          onClick={() => setMenuOpen(m => !m)}
          className="inline-flex items-center justify-center px-1.5 py-1 rounded-r-lg transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
          }}
          aria-label="More AI options"
        >
          <ChevronDown size={11} />
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div
              className="absolute top-full right-0 mt-1 z-50 rounded-xl border overflow-hidden shadow-xl min-w-36"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {(Object.entries(ACTION_LABELS) as [ImproveAction, string][]).map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleAction(action)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors hover:opacity-80"
                  style={{ color: 'var(--text)' }}
                >
                  <Sparkles size={11} style={{ color: 'var(--accent)' }} />
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Error tooltip */}
        {error && (
          <div
            className="absolute top-full left-0 mt-1 z-50 rounded-lg px-3 py-2 text-xs max-w-64 shadow-lg"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
            onClick={clearError}
            title="Click to dismiss"
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  // Simple single-action button
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleAction('improve')}
        title={disabled && !improving ? 'Enter text first' : 'AI: Improve writing'}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-80 ${className}`}
        style={{
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          border: '1px solid transparent',
        }}
      >
        {improving
          ? <Loader2 size={12} className="animate-spin" />
          : <Sparkles size={12} />
        }
        {improving ? 'Improving…' : 'AI Improve'}
      </button>

      {error && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg px-3 py-2 text-xs max-w-64 shadow-lg"
          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
          onClick={clearError}
          title="Click to dismiss"
        >
          {error}
        </div>
      )}
    </div>
  );
}
