'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, X, Sparkles, FileText, Calendar, MessageSquare, Loader2, Copy, Check, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'tasks' | 'content' | 'summarize' | 'schedule';

const MODES: { id: Mode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'tasks',     label: 'Generate Tasks',    icon: <Sparkles size={14} />,     desc: 'AI-generated task list for a client' },
  { id: 'content',   label: 'Write Content',     icon: <MessageSquare size={14} />, desc: 'Full marketing copy for social media' },
  { id: 'summarize', label: 'Summarize Report',  icon: <FileText size={14} />,      desc: 'Natural-language report summary' },
  { id: 'schedule',  label: 'Suggest Schedule',  icon: <Calendar size={14} />,      desc: 'Optimised task ordering' },
];

// ── Field styles ──────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' };

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
      style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Result action bar ─────────────────────────────────────────────────────────

function ResultActions({
  text,
  isLong,
  expanded,
  onToggle,
  onRegenerate,
}: {
  text: string;
  isLong: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRegenerate?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <CopyButton text={text} />
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={11} />
          Retry
        </button>
      )}
      {isLong && (
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      )}
    </div>
  );
}

// ── Result display ────────────────────────────────────────────────────────────

function ResultBox({ result, onRegenerate }: { result: string | string[]; onRegenerate?: () => void }) {
  const [expanded, setExpanded] = useState(true);

  if (Array.isArray(result)) {
    const fullText = result.join('\n');
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {result.length} Tasks Generated
          </p>
          <ResultActions text={fullText} isLong={false} expanded={true} onToggle={() => {}} onRegenerate={onRegenerate} />
        </div>
        {result.map((item, i) => (
          <div
            key={i}
            className="rounded-lg px-3 py-2.5"
            style={{ background: 'var(--surface-2)', borderLeft: '3px solid var(--accent)' }}
          >
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              <span className="text-xs font-bold mr-1.5" style={{ color: 'var(--accent)' }}>{i + 1}.</span>
              {item}
            </p>
          </div>
        ))}
      </div>
    );
  }

  const isLong = result.length > 400;

  return (
    <div className="rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b flex-wrap" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Result</p>
        <ResultActions
          text={result}
          isLong={isLong}
          expanded={expanded}
          onToggle={() => setExpanded(v => !v)}
          onRegenerate={onRegenerate}
        />
      </div>
      <div
        className="px-3 py-3 transition-all duration-300"
        style={{ overflowY: expanded ? 'auto' : 'hidden', maxHeight: expanded ? 'none' : '7rem' }}
      >
        <p
          className="text-sm whitespace-pre-wrap"
          style={{ color: 'var(--text)', lineHeight: '1.75', wordBreak: 'break-word' }}
        >
          {result}
        </p>
        {!expanded && isLong && (
          <div
            className="h-8 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, transparent, var(--surface-2))',
              marginTop: '-2rem',
              position: 'relative',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function AiAssistantPanel() {
  const [open, setOpen]         = useState(false);
  const [mode, setMode]         = useState<Mode>('tasks');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<string | string[] | null>(null);

  // Scroll-aware button state
  const [isScrolling, setIsScrolling]   = useState(false);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form fields
  const [clientName, setClientName]   = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform]       = useState('Instagram');
  const [tone, setTone]               = useState('professional');
  const [topic, setTopic]             = useState('');
  const [reportText, setReportText]   = useState('');
  const [taskJson, setTaskJson]       = useState('');

  // ── Scroll detection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) return;

    const handleScroll = () => {
      setIsScrolling(true);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => setIsScrolling(false), 800);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [open]);

  // ── Modal / overlay detection ───────────────────────────────────────────────
  useEffect(() => {
    const checkForModal = () => {
      const hasModal = !!(
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[aria-modal="true"]') ||
        document.querySelector('.fixed.inset-0[class*="bg-"]') ||
        document.querySelector('[data-modal="true"]')
      );
      setIsModalOpen(hasModal);
    };

    const observer = new MutationObserver(checkForModal);
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    checkForModal();
    return () => observer.disconnect();
  }, []);

  const isCollapsed = !open && (isScrolling || isModalOpen);
  // When a modal is open move the button above typical bottom-bar modal actions
  const bottomOffset = !open && isModalOpen ? '5rem' : '1.25rem';

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let url = '';
      let bodyObj: Record<string, unknown> = {};

      if (mode === 'tasks') {
        url = '/api/ai/generate-tasks';
        bodyObj = { clientName, description, count: 8 };
      } else if (mode === 'content') {
        url = '/api/ai/generate-content';
        bodyObj = { platform, tone, topic, clientName };
      } else if (mode === 'summarize') {
        url = '/api/ai/summarize-report';
        bodyObj = { reportData: reportText };
      } else if (mode === 'schedule') {
        url = '/api/ai/suggest-schedule';
        try { bodyObj = { tasks: JSON.parse(taskJson) }; } catch { throw new Error('Invalid JSON in tasks field'); }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bodyObj),
      });

      const json = await res.json() as Record<string, unknown>;
      if (!json.success) {
        if (res.status === 503) {
          throw new Error('AI is not configured. Please set GEMINI_API_KEY in your environment variables.');
        }
        throw new Error((json.error as string | undefined) ?? 'AI request failed');
      }

      if (mode === 'tasks') setResult((json.tasks as string[]) ?? []);
      else if (mode === 'content') setResult((json.content as string) ?? '');
      else if (mode === 'summarize') setResult((json.summary as string) ?? '');
      else if (mode === 'schedule') setResult(JSON.stringify(json.schedule, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [mode, clientName, description, platform, tone, topic, reportText, taskJson]);

  // ── Collapsed / expanded pill floating button ───────────────────────────────
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI Assistant"
        className="fixed z-50 flex items-center justify-center text-white shadow-lg"
        style={{
          background: 'var(--accent)',
          bottom: bottomOffset,
          right: '1.25rem',
          height: isCollapsed ? '2.5rem' : '2.75rem',
          minWidth: isCollapsed ? '2.5rem' : '0',
          paddingLeft: isCollapsed ? '0' : '1rem',
          paddingRight: isCollapsed ? '0' : '1rem',
          borderRadius: isCollapsed ? '50%' : '9999px',
          fontSize: '0.875rem',
          fontWeight: 600,
          overflow: 'hidden',
          transition: 'height 300ms ease, min-width 300ms ease, padding 300ms ease, border-radius 300ms ease, bottom 300ms ease',
        }}
      >
        <Bot size={18} style={{ flexShrink: 0 }} />
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            maxWidth: isCollapsed ? '0' : '8rem',
            opacity: isCollapsed ? 0 : 1,
            marginLeft: isCollapsed ? '0' : '0.5rem',
            transition: 'max-width 300ms ease, opacity 200ms ease, margin-left 300ms ease',
          }}
        >
          AI Assistant
        </span>
      </button>
    );
  }

  // ── Open panel ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed z-50 flex flex-col rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
        bottom: '1.25rem',
        right: '1.25rem',
        width: 'min(390px, calc(100vw - 2rem))',
        maxHeight: 'min(88vh, 700px)',
      }}
    >
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 border-b shrink-0"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
          style={{ background: 'var(--accent-soft)' }}
        >
          <Bot size={14} style={{ color: 'var(--accent)' }} />
        </div>
        <p className="text-sm font-bold flex-1" style={{ color: 'var(--text)' }}>AI Assistant</p>
        <button
          onClick={() => setOpen(false)}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:opacity-70 transition-opacity shrink-0"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Mode tabs ─────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 px-3 py-2.5 border-b shrink-0 overflow-x-auto"
        style={{ borderColor: 'var(--border)', scrollbarWidth: 'none' }}
      >
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setResult(null); setError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors"
            style={
              mode === m.id
                ? { background: 'var(--accent)', color: '#fff', whiteSpace: 'nowrap' }
                : { background: 'var(--surface-2)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }
            }
            title={m.desc}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Scrollable form + result body ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {MODES.find(m => m.id === mode)?.desc}
        </p>

        {mode === 'tasks' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Project Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the project or campaign…"
                className={`${inputCls} resize-none`}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {mode === 'content' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Platform</label>
                <select value={platform} onChange={e => setPlatform(e.target.value)} className={inputCls} style={inputStyle}>
                  {['Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'TikTok'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Tone</label>
                <select value={tone} onChange={e => setTone(e.target.value)} className={inputCls} style={inputStyle}>
                  {['professional', 'casual', 'funny', 'inspirational', 'promotional'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Topic <span style={{ color: 'var(--accent)' }}>*</span></label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. New product launch, summer sale…"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Brand / Client</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Optional brand name"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </>
        )}

        {mode === 'summarize' && (
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Report Data <span style={{ color: 'var(--accent)' }}>*</span></label>
            <textarea
              value={reportText}
              onChange={e => setReportText(e.target.value)}
              rows={6}
              placeholder="Paste your report data, numbers, or stats here…"
              className={`${inputCls} resize-none`}
              style={inputStyle}
            />
          </div>
        )}

        {mode === 'schedule' && (
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Tasks JSON <span style={{ color: 'var(--accent)' }}>*</span></label>
            <textarea
              value={taskJson}
              onChange={e => setTaskJson(e.target.value)}
              rows={5}
              placeholder={'[{"id":"1","title":"...","priority":"high","due_date":"2024-02-01","status":"todo"}]'}
              className={`${inputCls} resize-none font-mono text-xs`}
              style={inputStyle}
            />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Paste a JSON array of task objects.</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {error}
          </div>
        )}

        {result && <ResultBox result={result} onRegenerate={handleSubmit} />}
      </div>

      {/* ── Sticky footer ─────────────────────────────────────────────────── */}
      <div className="p-3 border-t shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
