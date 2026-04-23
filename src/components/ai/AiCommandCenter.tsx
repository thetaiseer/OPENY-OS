'use client';

/**
 * AiCommandCenter — the new system-wide AI operating layer.
 *
 * Replaces the old floating chat widget with a powerful side-panel that
 * supports four distinct modes:
 *
 *   Ask     — questions, summaries, explanations
 *   Do      — real actions: create records, update data, trigger workflows
 *   Suggest — next steps, priorities, scheduling, improvements
 *   Review  — data quality, missing info, duplicates, cleanup
 *
 * The panel is context-aware: it reads the current app section (dashboard,
 * clients, tasks, etc.) and shows relevant quick-action chips.
 *
 * Keyboard shortcut: Cmd/Ctrl + J
 */

import { useState, useRef, useCallback, useEffect, memo, FormEvent } from 'react';
import {
  Bot,
  X,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  Zap,
  Lightbulb,
  Search,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users2,
  FileText,
  FolderOpen,
  BarChart2,
  Users,
  LayoutDashboard,
  Cpu,
} from 'lucide-react';
import { useAi, type AiMode, type AppSection } from '@/context/ai-context';
import AppModal from '@/components/ui/AppModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  actions_taken?: string[];
  data?: Record<string, unknown>;
  status?: 'success' | 'error' | 'clarification' | 'pending';
}

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// ── Mode configuration ────────────────────────────────────────────────────────

const MODES: { id: AiMode; label: string; icon: React.ElementType; description: string }[] = [
  {
    id: 'ask',
    label: 'Ask',
    icon: Search,
    description: 'Questions, summaries & explanations',
  },
  {
    id: 'do',
    label: 'Do',
    icon: Zap,
    description: 'Create records, trigger actions',
  },
  {
    id: 'suggest',
    label: 'Suggest',
    icon: Lightbulb,
    description: 'Next steps, priorities, improvements',
  },
  {
    id: 'review',
    label: 'Review',
    icon: ClipboardList,
    description: 'Quality check, cleanup, detect issues',
  },
];

// ── Section metadata ──────────────────────────────────────────────────────────

type SectionMeta = {
  label: string;
  icon: React.ElementType;
  color: string;
  suggestions: Partial<Record<AiMode, string[]>>;
};

const SECTION_META: Record<AppSection, SectionMeta> = {
  dashboard: {
    label: 'Dashboard',
    icon: LayoutDashboard,
    color: 'var(--accent)',
    suggestions: {
      ask: [
        'Summarize my workspace today',
        'What are my overdue tasks?',
        'Which clients need attention?',
      ],
      do: ['Create a new task', 'Create a new client', 'Schedule a post'],
      suggest: ['What should I focus on today?', 'Suggest a weekly plan', 'What work is at risk?'],
      review: [
        'Run a full quality check',
        'Find tasks without assignees',
        'Find missing deadlines',
      ],
    },
  },
  clients: {
    label: 'Clients',
    icon: Users2,
    color: '#8b5cf6',
    suggestions: {
      ask: [
        'Summarize this client status',
        'What tasks are pending for this client?',
        'What is this client missing?',
      ],
      do: ['Create a client', 'Create onboarding tasks for this client', 'Create a content plan'],
      suggest: [
        'Suggest next steps for this client',
        'Suggest a monthly plan',
        'Suggest content themes',
      ],
      review: ['Review this client workspace', 'Find unassigned tasks', 'Find incomplete records'],
    },
  },
  tasks: {
    label: 'Tasks',
    icon: ClipboardList,
    color: '#f59e0b',
    suggestions: {
      ask: ['Show overdue tasks', 'Summarize pending work', 'What tasks are due this week?'],
      do: ['Create a task', 'Create multiple tasks', 'Assign tasks to team members'],
      suggest: [
        'Prioritize my tasks',
        'Suggest schedule for this week',
        'Suggest task assignments',
      ],
      review: ['Find tasks without assignees', 'Find tasks without deadlines', 'Find stale tasks'],
    },
  },
  content: {
    label: 'Content',
    icon: FileText,
    color: '#10b981',
    suggestions: {
      ask: [
        'Summarize the content pipeline',
        'What content is due soon?',
        'What is missing from this plan?',
      ],
      do: [
        'Generate content ideas',
        'Create a caption',
        'Create a content plan',
        'Schedule a post',
      ],
      suggest: [
        'Suggest content topics',
        'Suggest publishing dates',
        'Suggest improvements to this copy',
      ],
      review: [
        'Find content without schedule',
        'Find draft content',
        'Find content without captions',
      ],
    },
  },
  calendar: {
    label: 'Calendar',
    icon: Calendar,
    color: '#ef4444',
    suggestions: {
      ask: ['Summarize upcoming work', 'What is scheduled this week?', 'Are there any conflicts?'],
      do: ['Schedule a post', 'Add a task to the calendar', 'Create an event'],
      suggest: ['Suggest publishing dates', 'Suggest a weekly schedule', 'Optimize my schedule'],
      review: [
        'Find scheduling conflicts',
        'Find overdue scheduled items',
        'Find gaps in the schedule',
      ],
    },
  },
  assets: {
    label: 'Assets',
    icon: FolderOpen,
    color: '#06b6d4',
    suggestions: {
      ask: [
        'Summarize asset library',
        'What files were uploaded recently?',
        'Find assets for a client',
      ],
      do: ['Link assets to a client', 'Organize files by client', 'Create upload structure'],
      suggest: [
        'Suggest categories for files',
        'Suggest naming conventions',
        'Suggest folder structure',
      ],
      review: ['Find unclassified files', 'Find poorly named assets', 'Detect duplicate assets'],
    },
  },
  reports: {
    label: 'Reports',
    icon: BarChart2,
    color: '#f97316',
    suggestions: {
      ask: [
        'Summarize performance this month',
        'What are the key metrics?',
        'Which client is most active?',
      ],
      do: ['Generate a report summary', 'Generate monthly executive summary', 'Export insights'],
      suggest: [
        'Suggest areas for improvement',
        'Identify bottlenecks',
        'Identify top opportunities',
      ],
      review: ['Identify weak areas', 'Find incomplete reports', 'Surface workload risks'],
    },
  },
  team: {
    label: 'Team',
    icon: Users,
    color: '#84cc16',
    suggestions: {
      ask: ['Summarize team workload', 'Who is overloaded?', 'What is everyone working on?'],
      do: ['Assign tasks to team members', 'Invite a team member', 'Create a team plan'],
      suggest: [
        'Suggest task distribution',
        'Suggest workload balancing',
        'Suggest focus areas per member',
      ],
      review: [
        'Find overloaded team members',
        'Find idle team members',
        'Review task distribution',
      ],
    },
  },
  settings: {
    label: 'Settings',
    icon: Cpu,
    color: 'var(--text-secondary)',
    suggestions: {
      ask: [
        'What settings are available?',
        'How do I configure roles?',
        'Explain workspace settings',
      ],
      do: ['Update workspace name', 'Invite a team member', 'Create a new role'],
      suggest: [
        'Suggest security improvements',
        'Suggest role configurations',
        'Suggest notification settings',
      ],
      review: ['Review security settings', 'Find inactive team members', 'Review permission setup'],
    },
  },
  general: {
    label: 'OPENY OS',
    icon: Bot,
    color: 'var(--accent)',
    suggestions: {
      ask: ['What can you help me with?', 'Show me overdue tasks', 'Summarize my workspace'],
      do: ['Create a task', 'Create a client', 'Schedule a post'],
      suggest: ['What should I focus on today?', 'Suggest a weekly plan'],
      review: ['Run a full quality check', 'Find missing data'],
    },
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ActionCard = memo(function ActionCard({ actions }: { actions: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const visible = expanded ? actions : actions.slice(0, 3);

  return (
    <div className="mt-2 overflow-hidden rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--surface-2)' }}>
        <Zap size={12} style={{ color: 'var(--accent)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Actions Completed
        </span>
        {actions.length > 3 && (
          <button
            onClick={toggle}
            className="ml-auto flex items-center gap-0.5 text-xs hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? 'Less' : `+${actions.length - 3} more`}
          </button>
        )}
      </div>
      {visible.map((action, i) => (
        <div
          key={i}
          className="flex items-center gap-2 border-t px-3 py-1.5 text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <CheckCircle size={11} style={{ color: '#16a34a', flexShrink: 0 }} />
          {action}
        </div>
      ))}
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm"
          style={{
            background: 'var(--accent)',
            color: '#fff',
          }}
        >
          {msg.content}
        </div>
      </div>
    );
  }

  const statusIcon = (() => {
    if (msg.status === 'error')
      return <XCircle size={14} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />;
    if (msg.status === 'clarification')
      return <AlertCircle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />;
    if (msg.status === 'success')
      return <CheckCircle size={14} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />;
    return <Bot size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />;
  })();

  return (
    <div className="flex items-start gap-2.5">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--accent-soft)' }}
      >
        {statusIcon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          {msg.content}
        </div>
        {msg.actions_taken && msg.actions_taken.length > 0 && (
          <ActionCard actions={msg.actions_taken} />
        )}
        <p className="mt-1 pl-1 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {msg.intent && msg.intent !== 'unknown' && (
            <span className="ml-2 opacity-60">· {msg.intent.replace(/_/g, ' ')}</span>
          )}
        </p>
      </div>
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

export default function AiCommandCenter() {
  const { isOpen, close, mode, setMode, section, clientContext, initialPrompt } = useAi();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const meta = SECTION_META[section];
  const suggestions = meta.suggestions[mode] ?? meta.suggestions.ask ?? [];

  // Cmd/Ctrl+J shortcut is handled in Header; close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  // Pre-fill input from context
  useEffect(() => {
    if (isOpen && initialPrompt) {
      setInput(initialPrompt);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialPrompt]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildContextPrefix = useCallback((): string => {
    const parts: string[] = [`[Section: ${section}]`];
    if (clientContext?.name) parts.push(`[Client: ${clientContext.name}]`);
    if (mode !== 'ask') parts.push(`[Mode: ${mode}]`);
    return parts.join(' ') + ' ';
  }, [section, clientContext, mode]);

  const getModeInstruction = useCallback((): string => {
    switch (mode) {
      case 'do':
        return 'Execute the following action: ';
      case 'suggest':
        return 'Please suggest options and next steps for: ';
      case 'review':
        return 'Please review and identify issues with: ';
      default:
        return '';
    }
  }, [mode]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: genId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      const contextualMessage = buildContextPrefix() + getModeInstruction() + trimmed;

      try {
        let endpoint = '/api/ai/command';

        // Route to specialized endpoints based on keywords
        const lower = trimmed.toLowerCase();
        if (
          lower.includes('daily brief') ||
          lower.includes('daily summary') ||
          lower.includes("what's due today") ||
          lower.includes('what is due today') ||
          lower.includes("today's summary")
        ) {
          endpoint = '/api/ai/daily-brief';
        } else if (
          mode === 'review' ||
          lower.includes('quality check') ||
          lower.includes('find missing') ||
          lower.includes('detect duplicates') ||
          lower.includes('find unassigned') ||
          lower.includes('find tasks without') ||
          lower.includes('find content without')
        ) {
          endpoint = '/api/ai/quality-check';
        }

        const body =
          endpoint === '/api/ai/command'
            ? { message: contextualMessage }
            : { section, clientContext };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const json = (await res.json()) as {
          success: boolean;
          message?: string;
          summary?: string;
          brief?: string;
          issues?: string[];
          actions_taken?: string[];
          intent?: string;
          data?: Record<string, unknown>;
          needs_clarification?: boolean;
          clarification_question?: string;
          error?: string;
        };

        if (res.status === 503) {
          setUnconfigured(true);
          setMessages((prev) => [
            ...prev,
            {
              id: genId(),
              role: 'assistant',
              content:
                'AI features are not configured. Please set GEMINI_API_KEY to enable AI capabilities.',
              timestamp: new Date(),
              status: 'error',
            },
          ]);
          return;
        }

        if (json.needs_clarification && json.clarification_question) {
          setMessages((prev) => [
            ...prev,
            {
              id: genId(),
              role: 'assistant',
              content: json.clarification_question ?? 'Could you please clarify your request?',
              timestamp: new Date(),
              status: 'clarification',
            },
          ]);
          return;
        }

        const content =
          json.message ??
          json.summary ??
          json.brief ??
          (json.success ? 'Done.' : (json.error ?? 'Something went wrong.'));
        const issueLines = json.issues?.map((i) => `• ${i}`).join('\n') ?? '';
        const fullContent = issueLines ? `${content}\n\n${issueLines}` : content;

        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: 'assistant',
            content: fullContent,
            timestamp: new Date(),
            intent: json.intent,
            actions_taken: json.actions_taken,
            data: json.data,
            status: json.success ? 'success' : 'error',
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: genId(),
            role: 'assistant',
            content: `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            timestamp: new Date(),
            status: 'error',
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, buildContextPrefix, getModeInstruction, section, clientContext, mode],
  );

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      await sendMessage(input);
    },
    [input, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage(input);
      }
    },
    [input, sendMessage],
  );

  const handleSuggestion = useCallback(
    (s: string) => {
      void sendMessage(s);
    },
    [sendMessage],
  );

  const handleDailyBrief = useCallback(() => {
    void sendMessage('daily brief');
  }, [sendMessage]);

  const handleQualityCheck = useCallback(() => {
    setMode('review');
    void sendMessage('quality check');
  }, [sendMessage, setMode]);

  if (!isOpen) return null;

  const SectionIcon = meta.icon;

  return (
    <AppModal
      open
      onClose={close}
      hideHeader
      size="xl"
      panelClassName="max-w-[min(560px,calc(100vw-2rem))] overflow-hidden"
      bodyClassName="p-0 !overflow-hidden flex flex-col"
    >
      {/* ── Header ── */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: meta.color + '20' }}
        >
          <Sparkles size={18} style={{ color: meta.color }} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              AI Command Center
            </span>
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: meta.color + '20', color: meta.color }}
            >
              <SectionIcon size={9} />
              {meta.label}
            </span>
            {clientContext?.name && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                {clientContext.name}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            Intelligent operating layer · Ask, Do, Suggest, Review
          </p>
        </div>

        <button
          onClick={close}
          className="shrink-0 rounded-lg p-1.5 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Close AI"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Mode Tabs ── */}
      <div
        className="flex shrink-0 gap-1.5 border-b px-4 py-2.5"
        style={{ borderColor: 'var(--border)' }}
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={m.description}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--text-secondary)',
                border: active ? '1px solid var(--accent)' : '1px solid transparent',
              }}
            >
              <Icon size={12} />
              {m.label}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Quick actions */}
        <button
          onClick={handleDailyBrief}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all hover:opacity-80 disabled:opacity-40"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
          title="Generate daily brief"
        >
          <Calendar size={11} />
          Brief
        </button>

        <button
          onClick={handleQualityCheck}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all hover:opacity-80 disabled:opacity-40"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
          title="Run quality check"
        >
          <ClipboardList size={11} />
          QC
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center pb-8 text-center">
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: meta.color + '15' }}
            >
              <Sparkles size={26} style={{ color: meta.color }} />
            </div>
            <p className="mb-1 text-base font-semibold" style={{ color: 'var(--text)' }}>
              AI Command Center
            </p>
            <p
              className="max-w-xs text-xs leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {MODES.find((m) => m.id === mode)?.description ?? 'How can I help you today?'}
            </p>

            {/* Suggestion chips */}
            {suggestions.length > 0 && (
              <div className="mt-5 flex max-w-sm flex-wrap justify-center gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s)}
                    disabled={loading}
                    className="rounded-full px-3 py-1.5 text-left text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {unconfigured && (
              <div
                className="mt-4 max-w-xs rounded-xl px-4 py-3 text-xs"
                style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}
              >
                AI is not configured. Set GEMINI_API_KEY to enable AI features.
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {loading && (
          <div className="flex items-start gap-2.5">
            <div
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--accent-soft)' }}
            >
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="inline-flex items-center gap-1">
                <span className="animate-pulse">Thinking</span>
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>
                  .
                </span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>
                  .
                </span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>
                  .
                </span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Suggestion chips (when messages exist) ── */}
      {messages.length > 0 && (
        <div
          className="flex shrink-0 gap-1.5 overflow-x-auto border-t px-4 py-2"
          style={{ borderColor: 'var(--border)' }}
        >
          {suggestions.slice(0, 3).map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s)}
              disabled={loading}
              className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-all hover:opacity-80 disabled:opacity-40"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t px-4 py-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder={
              mode === 'do'
                ? 'Tell me what to do…'
                : mode === 'suggest'
                  ? 'What would you like suggestions for?'
                  : mode === 'review'
                    ? 'What should I review?'
                    : 'Ask anything…'
            }
            className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none"
            style={{ color: 'var(--text)' }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
            aria-label="Send"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          Enter to send · Shift+Enter for new line · Cmd+J to toggle
        </p>
      </form>
    </AppModal>
  );
}
