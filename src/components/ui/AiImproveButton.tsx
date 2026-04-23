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
import {
  OPENY_MENU_ITEM_COMPACT_CLASS,
  OPENY_MENU_PANEL_COMPACT_CLASS,
} from '@/components/ui/menu-system';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImproveAction = 'improve' | 'professional' | 'shorten' | 'expand' | 'name';

const ACTION_LABELS: Record<Exclude<ImproveAction, 'name'>, string> = {
  improve: 'Improve writing',
  professional: 'Make professional',
  shorten: 'Shorten',
  expand: 'Expand',
};

/** Count whitespace-separated words. */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Resolve the action to send based on the mode and text length.
 *  - 'name' mode → always send 'name' action (spelling + title case)
 *  - 'auto' mode → send 'name' for short text (≤5 words), 'improve' otherwise
 *  - explicit action → send as-is
 */
function resolveAction(text: string, mode: 'auto' | 'name', action: ImproveAction): ImproveAction {
  if (mode === 'name') return 'name';
  if (mode === 'auto' && action === 'improve' && countWords(text) <= 5) return 'name';
  return action;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAiImprove() {
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const improve = async (
    text: string,
    action: ImproveAction = 'improve',
  ): Promise<string | null> => {
    if (!text.trim()) return null;
    setImproving(true);
    setError(null);
    setUnavailable(false);
    try {
      const res = await fetch('/api/ai/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, action }),
      });
      const json = (await res.json()) as { success: boolean; improved?: string; error?: string };
      if (!json.success) {
        if (res.status === 503) {
          // AI not configured — mark as unavailable instead of showing error popup
          setUnavailable(true);
          return null;
        }
        setError(json.error ?? `AI improvement failed (HTTP ${res.status})`);
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

  return { improve, improving, error, clearError: () => setError(null), unavailable };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface AiImproveButtonProps {
  /** Current text to improve */
  value: string;
  /** Called with the improved text */
  onImproved: (improved: string) => void;
  /** Show full action menu instead of single button (default: false) */
  showMenu?: boolean;
  /**
   * Controls which AI action is used.
   *  - 'auto' (default): uses 'name' for short text (≤5 words), 'improve' for longer
   *  - 'name': always use the short-text action (spelling fix + title case + light polish)
   */
  mode?: 'auto' | 'name';
  /** Extra class names for the button */
  className?: string;
}

export default function AiImproveButton({
  value,
  onImproved,
  showMenu = false,
  mode = 'auto',
  className = '',
}: AiImproveButtonProps) {
  const { improve, improving, error, clearError, unavailable } = useAiImprove();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAction = async (action: ImproveAction) => {
    setMenuOpen(false);
    const resolved = resolveAction(value, mode, action);
    const result = await improve(value, resolved);
    if (result) onImproved(result);
  };

  const disabled = improving || !value.trim();

  // When AI is not configured, show a clearly disabled button with a tooltip.
  if (unavailable) {
    return (
      <button
        type="button"
        disabled
        title="AI writing is not configured (GEMINI_API_KEY is not set)"
        className={`inline-flex cursor-not-allowed items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium opacity-30 ${className}`}
        style={{
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          border: '1px solid transparent',
        }}
      >
        <Sparkles size={12} />
        AI
      </button>
    );
  }

  if (showMenu) {
    return (
      <div className="relative inline-flex items-center">
        {/* Main button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAction('improve')}
          title="AI: Improve writing"
          className={`inline-flex items-center gap-1 rounded-l-lg px-2 py-1 text-xs font-medium transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
          style={{
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
            borderRight: 'none',
          }}
        >
          {improving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          AI Improve
        </button>

        {/* Dropdown chevron */}
        <button
          type="button"
          disabled={improving}
          onClick={() => setMenuOpen((m) => !m)}
          className="inline-flex items-center justify-center rounded-r-lg px-1.5 py-1 transition-opacity hover:opacity-80 disabled:opacity-40"
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
              className={`absolute right-0 top-full z-50 mt-1 min-w-36 overflow-hidden ${OPENY_MENU_PANEL_COMPACT_CLASS}`}
            >
              {(Object.entries(ACTION_LABELS) as [Exclude<ImproveAction, 'name'>, string][]).map(
                ([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => handleAction(action)}
                    className={`${OPENY_MENU_ITEM_COMPACT_CLASS} text-left text-xs font-medium`}
                    style={{ color: 'var(--text)' }}
                  >
                    <Sparkles size={11} style={{ color: 'var(--accent)' }} />
                    {label}
                  </button>
                ),
              )}
            </div>
          </>
        )}

        {/* Error tooltip */}
        {error && (
          <div
            className="absolute left-0 top-full z-50 mt-1 max-w-64 rounded-lg px-3 py-2 text-xs shadow-lg"
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
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        style={{
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          border: '1px solid transparent',
        }}
      >
        {improving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {improving ? 'Improving…' : 'AI Improve'}
      </button>

      {error && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-w-64 rounded-lg px-3 py-2 text-xs shadow-lg"
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
