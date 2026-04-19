'use client';

import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown } from 'lucide-react';

export type ImproveAction = 'improve' | 'professional' | 'shorten' | 'expand' | 'name';

const ACTION_LABELS: Record<Exclude<ImproveAction, 'name'>, string> = {
  improve: 'Improve writing',
  professional: 'Make professional',
  shorten: 'Shorten',
  expand: 'Expand',
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function resolveAction(text: string, mode: 'auto' | 'name', action: ImproveAction): ImproveAction {
  if (mode === 'name') return 'name';
  if (mode === 'auto' && action === 'improve' && countWords(text) <= 5) return 'name';
  return action;
}

export function useAiImprove() {
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const improve = async (text: string, action: ImproveAction = 'improve'): Promise<string | null> => {
    if (!text.trim()) return null;

    setImproving(true);
    setError(null);
    setUnavailable(false);

    try {
      const response = await fetch('/api/ai/improve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, action }),
      });

      const json = (await response.json()) as { success: boolean; improved?: string; error?: string };
      if (!json.success) {
        if (response.status === 503) {
          setUnavailable(true);
          return null;
        }
        setError(json.error ?? `AI improvement failed (HTTP ${response.status})`);
        return null;
      }

      return json.improved ?? null;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Network error');
      return null;
    } finally {
      setImproving(false);
    }
  };

  return { improve, improving, error, clearError: () => setError(null), unavailable };
}

interface AiImproveButtonProps {
  value: string;
  onImproved: (improved: string) => void;
  showMenu?: boolean;
  mode?: 'auto' | 'name';
  className?: string;
}

export default function AiImproveButton({ value, onImproved, showMenu = false, mode = 'auto', className = '' }: AiImproveButtonProps) {
  const { improve, improving, error, clearError, unavailable } = useAiImprove();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleAction(action: ImproveAction) {
    setMenuOpen(false);
    const result = await improve(value, resolveAction(value, mode, action));
    if (result) onImproved(result);
  }

  const disabled = improving || !value.trim() || unavailable;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleAction('improve')}
        title={unavailable ? 'AI writing is not configured' : 'AI Improve'}
        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
        style={{ borderColor: 'var(--border)', background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        {improving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {improving ? 'Improving…' : 'AI Improve'}
      </button>

      {showMenu ? (
        <>
          <button
            type="button"
            disabled={improving || unavailable}
            onClick={() => setMenuOpen((value) => !value)}
            className="ml-1 inline-flex items-center justify-center rounded-lg border p-1 disabled:opacity-40"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            aria-label="More AI actions"
          >
            <ChevronDown size={12} />
          </button>

          {menuOpen ? (
            <div className="openy-menu-panel absolute right-0 top-full z-50 mt-1.5 min-w-40 rounded-xl p-1.5">
              {(Object.entries(ACTION_LABELS) as Array<[Exclude<ImproveAction, 'name'>, string]>).map(([action, label]) => (
                <button key={action} type="button" onClick={() => handleAction(action)} className="openy-menu-item w-full rounded-lg px-2.5 py-2 text-left text-xs">
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {error ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-w-64 rounded-lg border px-2.5 py-2 text-xs"
          style={{ borderColor: 'var(--color-danger-border)', background: 'var(--surface)', color: 'var(--color-danger)' }}
          onClick={clearError}
          title="Click to dismiss"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
