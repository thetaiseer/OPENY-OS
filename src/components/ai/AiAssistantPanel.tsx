'use client';

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
  Bot, X, Send, Loader2, CheckCircle, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Clock, Zap,
} from 'lucide-react';

// ── Stable ID generator ───────────────────────────────────────────────────────
// NOTE: The original implementation had an inverted guard that caused infinite
// recursion (calling genId() when crypto.randomUUID IS available). Fixed below.
function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  actions_taken?: string[];
  entities?: Record<string, unknown>;
  data?: Record<string, unknown>;
  status?: 'success' | 'error' | 'clarification' | 'pending';
}

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority?: string;
  due_date?: string;
  client_name?: string;
};

// ── Static suggestions (never recomputed) ─────────────────────────────────────

const SUGGESTIONS: readonly string[] = [
  'وريني كل التاسكات المتأخرة',
  'اعمل تاسك جديد',
  'دور على عميل',
  'اعمل 3 أفكار ريلز',
  'Schedule a post on Instagram',
  'List all active tasks',
];

// ── Memoized sub-components ───────────────────────────────────────────────────

const EntityChip = memo(function EntityChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mr-1 mb-1"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
      {value}
    </span>
  );
});

const ActionCard = memo(function ActionCard({ actions }: { actions: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded(v => !v), []);
  const visible = expanded ? actions : actions.slice(0, 2);
  return (
    <div className="mt-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'var(--surface-2)' }}>
        <Zap size={12} style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Actions Taken
        </span>
        {actions.length > 2 && (
          <button
            onClick={toggle}
            className="ml-auto flex items-center gap-0.5 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? 'Less' : `+${actions.length - 2} more`}
          </button>
        )}
      </div>
      {visible.map((action, i) => (
        <div
          key={i}
          className="px-3 py-1.5 flex items-center gap-2 border-t text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <CheckCircle size={11} style={{ color: '#16a34a', flexShrink: 0 }} />
          {action}
        </div>
      ))}
    </div>
  );
});

const TaskList = memo(function TaskList({ tasks }: { tasks: TaskRow[] }) {
  return (
    <div className="mt-2 space-y-1">
      {tasks.slice(0, 8).map(task => (
        <div
          key={task.id}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <span className="flex-1 font-medium truncate" style={{ color: 'var(--text)' }}>{task.title}</span>
          <span
            className="px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              background: task.status === 'completed' ? 'rgba(22,163,74,0.1)' : task.status === 'todo' ? 'rgba(99,102,241,0.1)' : 'rgba(234,179,8,0.1)',
              color: task.status === 'completed' ? '#16a34a' : task.status === 'todo' ? '#6366f1' : '#d97706',
            }}
          >
            {task.status}
          </span>
          {task.due_date && (
            <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});

const AssistantMessage = memo(function AssistantMessage({ msg }: { msg: Message }) {
  const isSuccess = msg.status === 'success';
  const isError = msg.status === 'error';
  const isClarification = msg.status === 'clarification';

  const entities = msg.entities ?? {};
  const detectedEntities = Object.entries(entities).filter(
    ([, v]) => v != null && !(typeof v === 'string' && v === '') && !Array.isArray(v),
  );
  const detectedArrays = Object.entries(entities).filter(
    ([, v]) => Array.isArray(v) && (v as unknown[]).length > 0,
  );

  return (
    <div className="flex gap-2.5 max-w-full">
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'var(--accent-soft)' }}
      >
        <Bot size={12} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        {(isSuccess || isError) && (
          <div className="flex items-center gap-1.5 mb-1.5">
            {isSuccess
              ? <CheckCircle size={13} style={{ color: '#16a34a' }} />
              : <XCircle size={13} style={{ color: '#ef4444' }} />
            }
            <span className="text-xs font-semibold" style={{ color: isSuccess ? '#16a34a' : '#ef4444' }}>
              {isSuccess ? 'Done' : 'Failed'}
            </span>
            {msg.intent && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full ml-1"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              >
                {msg.intent.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )}
        {isClarification && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle size={13} style={{ color: '#d97706' }} />
            <span className="text-xs font-semibold" style={{ color: '#d97706' }}>Clarification needed</span>
          </div>
        )}

        <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
          {msg.content}
        </p>

        {detectedEntities.length > 0 && (
          <div className="mt-2 flex flex-wrap">
            {detectedEntities.map(([k, v]) => (
              <EntityChip key={k} label={k.replace(/_/g, ' ')} value={String(v)} />
            ))}
            {detectedArrays.map(([k, v]) => (
              <EntityChip key={k} label={k.replace(/_/g, ' ')} value={(v as unknown[]).map(String).join(', ')} />
            ))}
          </div>
        )}

        {msg.actions_taken && msg.actions_taken.length > 0 && (
          <ActionCard actions={msg.actions_taken} />
        )}

        {Array.isArray(msg.data?.tasks) && (msg.data.tasks as unknown[]).length > 0 && (
          <TaskList tasks={msg.data.tasks as TaskRow[]} />
        )}

        {typeof msg.data?.ideas === 'string' && (
          <div
            className="mt-2 rounded-lg px-3 py-2.5 text-xs whitespace-pre-wrap"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', lineHeight: 1.7 }}
          >
            {msg.data.ideas as string}
          </div>
        )}

        <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
});

const UserMessage = memo(function UserMessage({ msg }: { msg: Message }) {
  return (
    <div className="flex gap-2.5 justify-end max-w-full">
      <div
        className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm text-sm"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        <p style={{ lineHeight: 1.6 }}>{msg.content}</p>
        <p className="text-xs mt-1 opacity-70">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
});

// ── AISuggestions ─────────────────────────────────────────────────────────────

interface AISuggestionsProps {
  onSelect: (suggestion: string) => void;
}

const AISuggestions = memo(function AISuggestions({ onSelect }: AISuggestionsProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2.5">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'var(--accent-soft)' }}
        >
          <Bot size={12} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            مرحبا! أنا مساعد OPENY OS. أقدر أساعدك في إنشاء مهام، جدولة منشورات، البحث عن عملاء، وأكثر.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Hi! I can create tasks, schedule posts, search clients, invite team members, and more. Just tell me what you need.
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
          <Clock size={10} className="inline mr-1" />
          Try saying:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => onSelect(s)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors hover:opacity-80"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

// ── AIInputBox ────────────────────────────────────────────────────────────────

interface AIInputBoxProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

const AIInputBox = memo(function AIInputBox({ value, onChange, onSubmit, isSubmitting }: AIInputBoxProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
    [onChange],
  );
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  return (
    <div
      className="shrink-0 p-3 border-t"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      <div
        className="flex items-end gap-2 rounded-xl px-3 py-2"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="اكتب أمرك... / Type a command…"
          rows={1}
          className="flex-1 bg-transparent text-sm outline-none resize-none leading-relaxed"
          style={{ color: 'var(--text)', maxHeight: '6rem', scrollbarWidth: 'none' }}
        />
        <button
          onClick={onSubmit}
          disabled={isSubmitting || !value.trim()}
          className="flex items-center justify-center w-7 h-7 rounded-lg transition-opacity disabled:opacity-40 shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          <Send size={13} style={{ color: '#fff' }} />
        </button>
      </div>
      <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--text-secondary)' }}>
        Enter to send • Shift+Enter for new line
      </p>
    </div>
  );
});

// ── useAICommandState ─────────────────────────────────────────────────────────
// Encapsulates all async command state. sendMessage is stable (no dep changes).

interface CommandApiResponse {
  success: boolean;
  intent?: string;
  entities?: Record<string, unknown>;
  message?: string;
  data?: Record<string, unknown>;
  actions_taken?: string[];
  needs_clarification?: boolean;
  clarification_question?: string;
  error?: string;
}

function useAICommandState() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync ref so sendMessage never captures a stale `input` value
  const inputRef = useRef('');
  const isSubmittingRef = useRef(false); // synchronous guard — prevents race conditions
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Keep inputRef in sync with state
  const handleSetInput = useCallback((val: string) => {
    inputRef.current = val;
    setInput(val);
  }, []);

  // sendMessage is stable: no deps that change on every keystroke
  const sendMessage = useCallback(async (suggestionText?: string) => {
    const messageText = suggestionText !== undefined
      ? suggestionText.trim()
      : inputRef.current.trim();

    if (!messageText || isSubmittingRef.current) return;

    // Abort any in-flight request before starting a new one
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // Synchronous guard — prevents duplicate submissions from rapid clicks
    isSubmittingRef.current = true;

    // Clear the input field immediately (only when using the typed input)
    if (suggestionText === undefined) {
      inputRef.current = '';
      setInput('');
    }

    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: messageText }),
        signal: abortRef.current.signal,
      });

      const json = await res.json() as CommandApiResponse;

      if (!mountedRef.current) return;

      const assistantMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: json.needs_clarification
          ? (json.clarification_question ?? 'Can you clarify?')
          : (json.message ?? (json.success ? 'Done!' : (json.error ?? 'Something went wrong'))),
        timestamp: new Date(),
        intent: json.intent,
        entities: json.entities,
        data: json.data,
        actions_taken: json.actions_taken,
        status: json.needs_clarification
          ? 'clarification'
          : (res.status === 503 ? 'error' : json.success ? 'success' : 'error'),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      // AbortError means the request was intentionally cancelled — silently ignore
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!mountedRef.current) return;

      setMessages(prev => [...prev, {
        id: genId(),
        role: 'assistant',
        content: 'Connection error. Please try again.',
        timestamp: new Date(),
        status: 'error' as const,
      }]);
    } finally {
      if (mountedRef.current) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    }
  }, []); // stable — no external deps

  // Abort in-flight request on unmount to avoid state updates after unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  return { messages, input, setInput: handleSetInput, isSubmitting, sendMessage };
}

// ── AIPanel ───────────────────────────────────────────────────────────────────

function AIPanel({ onClose }: { onClose: () => void }) {
  const { messages, input, setInput, isSubmitting, sendMessage } = useAICommandState();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(() => void sendMessage(), [sendMessage]);
  const handleSuggestion = useCallback((s: string) => void sendMessage(s), [sendMessage]);

  return (
    <div
      className="fixed z-50 flex flex-col rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
        bottom: '1.25rem',
        right: '1.25rem',
        width: 'min(420px, calc(100vw - 2rem))',
        maxHeight: 'min(88vh, 720px)',
      }}
    >
      {/* Header */}
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
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>AI Assistant</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your workspace operator</p>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:opacity-70 transition-opacity shrink-0"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0
          ? <AISuggestions onSelect={handleSuggestion} />
          : messages.map(msg =>
              msg.role === 'user'
                ? <UserMessage key={msg.id} msg={msg} />
                : <AssistantMessage key={msg.id} msg={msg} />
            )
        }

        {isSubmitting && (
          <div className="flex gap-2.5">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-soft)' }}
            >
              <Bot size={12} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
              <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Processing…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <AIInputBox
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

// ── AIChatLauncher ────────────────────────────────────────────────────────────

function AIChatLauncher({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open AI Assistant"
      className="fixed z-50 flex items-center justify-center text-white shadow-lg"
      style={{
        background: 'var(--accent)',
        bottom: '1.25rem',
        right: '1.25rem',
        height: '2.75rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        borderRadius: '9999px',
        fontSize: '0.875rem',
        fontWeight: 600,
      }}
    >
      <Bot size={18} style={{ flexShrink: 0 }} />
      <span style={{ whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>AI Assistant</span>
    </button>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function AiAssistantPanel() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  if (!open) {
    return <AIChatLauncher onClick={handleOpen} />;
  }

  return <AIPanel onClose={handleClose} />;
}
