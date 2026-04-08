'use client';

import { useState } from 'react';
import { Bot, X, Sparkles, FileText, Calendar, MessageSquare, Loader2, Copy, Check } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'tasks' | 'content' | 'summarize' | 'schedule';

const MODES: { id: Mode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'tasks',     label: 'Generate Tasks',   icon: <Sparkles size={15} />,     desc: 'AI-generated task list for a client' },
  { id: 'content',   label: 'Write Content',    icon: <MessageSquare size={15} />, desc: 'Captions & social media copy' },
  { id: 'summarize', label: 'Summarize Report', icon: <FileText size={15} />,      desc: 'Natural-language report summary' },
  { id: 'schedule',  label: 'Suggest Schedule', icon: <Calendar size={15} />,      desc: 'Optimised task ordering' },
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

// ── Result display ────────────────────────────────────────────────────────────

function ResultBox({ result, onApply }: { result: string | string[]; onApply?: (item: string) => void }) {
  if (Array.isArray(result)) {
    return (
      <div className="space-y-2">
        {result.map((item, i) => (
          <div key={i} className="flex items-start justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
            <p className="text-sm flex-1" style={{ color: 'var(--text)' }}>{item}</p>
            {onApply && (
              <button
                onClick={() => onApply(item)}
                className="text-xs px-2 py-1 rounded-md text-white shrink-0"
                style={{ background: 'var(--accent)' }}
              >
                Use
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--surface-2)' }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Result</p>
        <CopyButton text={result} />
      </div>
      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{result}</p>
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

  // Form fields
  const [clientName, setClientName]   = useState('');
  const [description, setDescription] = useState('');
  const [platform, setPlatform]       = useState('Instagram');
  const [tone, setTone]               = useState('professional');
  const [topic, setTopic]             = useState('');
  const [reportText, setReportText]   = useState('');
  const [taskJson, setTaskJson]       = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let url = '';
      let bodyObj: Record<string, unknown> = {};

      if (mode === 'tasks') {
        url = '/api/ai/generate-tasks';
        bodyObj = { clientName, description, count: 5 };
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
        const errMsg = (json.error as string | undefined) ?? 'AI request failed';
        // HTTP 503 means AI keys are not configured — surface a clear actionable message
        if (res.status === 503) {
          throw new Error('AI is not configured. Please set GEMINI_API_KEY in your environment variables.');
        }
        throw new Error(errMsg);
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
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 h-11 px-4 rounded-full shadow-lg text-white font-medium text-sm transition-opacity hover:opacity-90"
        style={{ background: 'var(--accent)' }}
        title="AI Assistant"
      >
        <Bot size={18} />
        <span>AI Assistant</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        width: 360,
        maxHeight: '85vh',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: 'var(--accent-soft)' }}>
          <Bot size={14} style={{ color: 'var(--accent)' }} />
        </div>
        <p className="text-sm font-bold flex-1" style={{ color: 'var(--text)' }}>AI Assistant</p>
        <button onClick={() => setOpen(false)} className="w-6 h-6 flex items-center justify-center rounded-md hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
          <X size={14} />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-3 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setResult(null); setError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors"
            style={
              mode === m.id
                ? { background: 'var(--accent)', color: '#fff' }
                : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }
            }
            title={m.desc}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mode === 'tasks' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Client Name</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Acme Corp" className={inputCls} style={inputStyle} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Project Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe the project or campaign…" className={`${inputCls} resize-none`} style={inputStyle} />
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
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Topic *</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. New product launch, summer sale…" className={inputCls} style={inputStyle} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Brand / Client</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Optional brand name" className={inputCls} style={inputStyle} />
            </div>
          </>
        )}

        {mode === 'summarize' && (
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Report Data *</label>
            <textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={6} placeholder="Paste your report data, numbers, or stats here…" className={`${inputCls} resize-none`} style={inputStyle} />
          </div>
        )}

        {mode === 'schedule' && (
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Tasks JSON *</label>
            <textarea value={taskJson} onChange={e => setTaskJson(e.target.value)} rows={5} placeholder={'[{"id":"1","title":"...","priority":"high","due_date":"2024-02-01","status":"todo"}]'} className={`${inputCls} resize-none font-mono text-xs`} style={inputStyle} />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Paste a JSON array of task objects.</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {error}
          </div>
        )}

        {result && <ResultBox result={result} />}
      </div>

      {/* Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </div>
  );
}
