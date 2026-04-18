'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  Bot,
  X,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Minimize2,
  Maximize2,
  MessageSquare,
  Plus,
  Upload,
  ExternalLink,
  WandSparkles,
} from 'lucide-react';
import { useAi, type AiMode, type AppSection } from '@/lib/ai-context';
import { useUpload, type InitialUploadItem } from '@/lib/upload-context';
import { useAuth } from '@/lib/auth-context';
import { MAIN_CATEGORIES, SUBCATEGORIES } from '@/lib/asset-utils';
import { queryClient } from '@/app/providers';

type MessageStatus = 'success' | 'error' | 'clarification' | 'pending';

interface PendingAction {
  intent: string;
  entities: Record<string, unknown>;
  professional_title?: string | null;
  professional_description?: string | null;
  confidence: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  intent?: string;
  actionsTaken?: string[];
  openUrl?: string | null;
  needsConfirmation?: boolean;
  pendingAction?: PendingAction;
  matchedClients?: Array<{ id: string; name: string; score: number }>;
}

interface SessionItem {
  id: string;
  title: string;
  mode: AiMode;
  section: AppSection;
  latest_at: string;
}

interface UploadDraft {
  files: File[];
  clientName: string;
  clientId: string;
  mainCategory: string;
  subCategory: string;
  monthKey: string;
  contentType: string;
}

interface ClientOption {
  id: string;
  name: string;
}

function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function nowMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fileBaseName(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

function detectLanguage(text: string): 'ar' | 'en' {
  const ar = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  return ar >= en ? 'ar' : 'en';
}

const SECTION_SUGGESTIONS: Record<AppSection, string[]> = {
  dashboard: ['أضف مهمة', 'اعرض المهام المتأخرة', 'ما ملخص يومي؟'],
  clients: ['ابحث عن عميل', 'أضف عميل', 'أنشئ مشروع'],
  tasks: ['أضف مهمة', 'حدّث مهمة', 'اعرض المهام المتأخرة'],
  content: ['أضف محتوى', 'أنشئ خطة محتوى', 'لخّص المحتوى'],
  calendar: ['ما المجدول هذا الأسبوع؟', 'أنشئ schedule', 'هل توجد تعارضات؟'],
  assets: ['ارفع ملف', 'نظّم الملفات', 'ابحث عن ملف'],
  reports: ['ما الملخص اليومي؟', 'حلّل الأداء', 'اعرض المخاطر'],
  team: ['وزّع المهام', 'من overloaded؟', 'خطط الأسبوع'],
  settings: ['راجع الصلاحيات', 'اقترح تحسينات أمان', 'راجع الإشعارات'],
  general: ['أضف مهمة', 'أضف عميل', 'ارفع ملف'],
};

function statusIcon(status?: MessageStatus) {
  if (status === 'success') return <CheckCircle2 size={15} style={{ color: '#16a34a' }} />;
  if (status === 'error') return <XCircle size={15} style={{ color: '#ef4444' }} />;
  if (status === 'clarification') return <AlertTriangle size={15} style={{ color: '#d97706' }} />;
  return <Bot size={15} style={{ color: 'var(--accent)' }} />;
}

export default function AiCommandCenter() {
  const { isOpen, close, mode, setMode, section, clientContext, initialPrompt } = useAi();
  const { startBatch } = useUpload();
  const { user } = useAuth();
  const filePickerRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [uploadDraft, setUploadDraft] = useState<UploadDraft | null>(null);

  const suggestions = useMemo(() => {
    const base = SECTION_SUGGESTIONS[section] ?? SECTION_SUGGESTIONS.general;
    return section === 'assets' ? [...base, 'أضف الأصول دي للعميل'] : base;
  }, [section]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/sessions?limit=30');
      const json = await res.json();
      if (!res.ok || !json?.success) return;
      setSessions((json.sessions ?? []).map((s: Record<string, unknown>) => ({
        id: String(s.id),
        title: String(s.title ?? 'New conversation'),
        mode: (s.mode as AiMode) ?? 'ask',
        section: (s.section as AppSection) ?? 'general',
        latest_at: String(s.latest_at ?? s.created_at ?? ''),
      })));
    } catch {
      // ignore
    }
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      const json = await res.json();
      if (!res.ok || !json?.success) return;
      setClients((json.clients ?? []).map((c: Record<string, unknown>) => ({
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
      })).filter(c => c.id && c.name));
    } catch {
      // ignore
    }
  }, []);

  const loadSessionMessages = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ai/sessions/${id}`);
      const json = await res.json();
      if (!res.ok || !json?.success) return;
      const loaded: Message[] = (json.messages ?? []).map((m: Record<string, unknown>) => ({
        id: String(m.id ?? genId()),
        role: (m.role as 'user' | 'assistant') ?? 'assistant',
        content: String(m.content ?? ''),
        timestamp: new Date(String(m.timestamp ?? new Date().toISOString())),
        intent: typeof m.intent === 'string' ? m.intent : undefined,
        status: (m.status as MessageStatus) ?? undefined,
        actionsTaken: Array.isArray(m.actions_taken) ? m.actions_taken.map(String) : undefined,
      }));
      setMessages(loaded);
      setSessionId(id);
      setShowHistory(false);
    } catch {
      // ignore
    }
  }, []);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setUploadDraft(null);
    setShowHistory(false);
    setInput('');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadSessions();
    void loadClients();
  }, [isOpen, loadSessions, loadClients]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialPrompt) setInput(initialPrompt);
    const t = setTimeout(() => textareaRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen, initialPrompt]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, uploadDraft]);

  const contextPayload = useMemo(() => {
    let contextualClient = clientContext;
    if (!contextualClient?.id && typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.includes('/clients/')) {
        try {
          const saved = window.localStorage.getItem('openy_last_client');
          if (saved) {
            const parsed = JSON.parse(saved) as { id?: string; name?: string; slug?: string };
            if (parsed?.id) contextualClient = { id: parsed.id, name: parsed.name, slug: parsed.slug };
          }
        } catch {
          // ignore
        }
      }
    }
    return {
      mode,
      section,
      clientContext: contextualClient ?? null,
    };
  }, [mode, section, clientContext]);

  const invalidateAfterAction = useCallback((intent?: string) => {
    if (!intent) return;
    const invalidate = (key: string) => void queryClient.invalidateQueries({ queryKey: [key] });
    if (intent.includes('task')) {
      ['tasks', 'tasks-all', 'tasks-my', 'dashboard-stats', 'activities', 'calendar'].forEach(invalidate);
    }
    if (intent.includes('client')) {
      ['clients', 'clients-list', 'clients-stats', 'dashboard-active-clients', 'activities'].forEach(invalidate);
    }
    if (intent.includes('project')) invalidate('projects');
    if (intent.includes('content')) invalidate('content-items');
    if (intent.includes('publish')) invalidate('scheduled-posts');
  }, []);

  const sendMessage = useCallback(async (rawText: string, pendingAction?: PendingAction, confirm = false) => {
    const text = rawText.trim();
    if (loading || (!text && !pendingAction)) return;

    if (text) {
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      }]);
      setInput('');
    }

    setLoading(true);
    try {
      const res = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          context: contextPayload,
          pending_action: pendingAction,
          confirm_action: confirm,
        }),
      });

      const json = await res.json() as {
        success: boolean;
        message?: string;
        error?: string;
        intent?: string;
        actions_taken?: string[];
        needs_clarification?: boolean;
        clarification_question?: string;
        needs_confirmation?: boolean;
        confirmation_message?: string;
        pending_action?: PendingAction;
        matched_clients?: Array<{ id: string; name: string; score: number }>;
        session_id?: string;
        open_url?: string | null;
      };

      if (json.session_id) setSessionId(json.session_id);

      if (json.needs_confirmation && json.pending_action) {
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'assistant',
          content: json.confirmation_message ?? 'Please confirm before execution.',
          timestamp: new Date(),
          status: 'pending',
          intent: json.intent,
          needsConfirmation: true,
          pendingAction: json.pending_action,
          matchedClients: json.matched_clients,
        }]);
        void loadSessions();
        return;
      }

      if (json.needs_clarification) {
        setMessages(prev => [...prev, {
          id: genId(),
          role: 'assistant',
          content: json.clarification_question ?? 'Could you clarify your request?',
          timestamp: new Date(),
          status: 'clarification',
          intent: json.intent,
        }]);
        void loadSessions();
        return;
      }

      const assistantText = json.message ?? json.error ?? (json.success ? 'Done.' : 'Action failed.');
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'assistant',
        content: assistantText,
        timestamp: new Date(),
        status: json.success ? 'success' : 'error',
        intent: json.intent,
        actionsTaken: json.actions_taken,
        openUrl: json.open_url ?? null,
      }]);

      if (json.success) invalidateAfterAction(json.intent);
      void loadSessions();
    } catch (err) {
      setMessages(prev => [...prev, {
        id: genId(),
        role: 'assistant',
        content: `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
        status: 'error',
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, sessionId, contextPayload, invalidateAfterAction, loadSessions]);

  const onSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  }, [sendMessage, input]);

  const onPickFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const language = detectLanguage(messages[messages.length - 1]?.content ?? input);
    const inferredClient = contextPayload.clientContext?.name ?? '';
    const inferredClientId = contextPayload.clientContext?.id ?? '';
    setUploadDraft({
      files: fileArray,
      clientName: inferredClient,
      clientId: inferredClientId,
      mainCategory: 'social-media',
      subCategory: SUBCATEGORIES['social-media'][0]?.slug ?? '',
      monthKey: nowMonthKey(),
      contentType: 'content_asset',
    });
    setMessages(prev => [...prev, {
      id: genId(),
      role: 'assistant',
      content: language === 'ar'
        ? `تم اختيار ${fileArray.length} ملف. أكمل البيانات ثم نفّذ الرفع.`
        : `${fileArray.length} file(s) selected. Complete metadata and run upload.`,
      timestamp: new Date(),
      status: 'pending',
    }]);
  }, [contextPayload, input, messages]);

  const runUpload = useCallback(() => {
    if (!uploadDraft || uploadDraft.files.length === 0) return;
    if (!uploadDraft.clientName || !uploadDraft.mainCategory || !uploadDraft.monthKey) return;

    const items: InitialUploadItem[] = uploadDraft.files.map((file) => ({
      id: genId(),
      file,
      previewUrl: null,
      uploadName: fileBaseName(file.name),
    }));

    startBatch(items, {
      clientName: uploadDraft.clientName,
      clientId: uploadDraft.clientId,
      contentType: uploadDraft.contentType,
      mainCategory: uploadDraft.mainCategory,
      subCategory: uploadDraft.subCategory,
      monthKey: uploadDraft.monthKey,
      uploadedBy: user?.name ?? user?.email ?? null,
      uploadedByEmail: user?.email ?? null,
    });

    const monthLabel = uploadDraft.monthKey;
    setMessages(prev => [...prev, {
      id: genId(),
      role: 'assistant',
      content: `Upload queued. Path suggestion: ${uploadDraft.clientName} > ${uploadDraft.mainCategory} > ${monthLabel}${uploadDraft.subCategory ? ` > ${uploadDraft.subCategory}` : ''}`,
      timestamp: new Date(),
      status: 'success',
      actionsTaken: ['Prepared upload batch', 'Queued files to global uploader'],
      openUrl: '/assets',
    }]);

    setUploadDraft(null);
    invalidateAfterAction('upload_asset');
  }, [uploadDraft, startBatch, user, invalidateAfterAction]);

  const handleSuggestion = useCallback((s: string) => {
    if (s.includes('ارفع') || s.toLowerCase().includes('upload')) {
      filePickerRef.current?.click();
      return;
    }
    void sendMessage(s);
  }, [sendMessage]);

  if (!isOpen) return null;

  const popupWidth = expanded ? 'min(860px, 96vw)' : 'min(460px, 96vw)';
  const popupHeight = expanded ? '84vh' : '72vh';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1.5px]" onClick={close} />

      <section
        className="fixed z-50 bottom-5 right-5 rounded-2xl overflow-hidden flex flex-col"
        style={{
          width: popupWidth,
          height: popupHeight,
          background: 'color-mix(in srgb, var(--surface) 90%, transparent)',
          border: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
          boxShadow: '0 14px 40px rgba(15,23,42,0.22)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <header
          className="px-4 py-3 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--surface-2) 85%, transparent)' }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)' }}>
            <Sparkles size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI Assistant</p>
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {loading ? 'Thinking…' : 'Ready'} · {section}
            </p>
          </div>

          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => setShowHistory(v => !v)}
            title="Conversation history"
          >
            <MessageSquare size={14} />
          </button>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-secondary)' }}
            onClick={() => setExpanded(v => !v)}
            title={expanded ? 'Compact' : 'Expand'}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: 'var(--text-secondary)' }}
            onClick={close}
            title="Close"
          >
            <X size={15} />
          </button>
        </header>

        {showHistory && (
          <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <button
              onClick={startNewChat}
              className="w-full mb-2 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Plus size={12} /> New chat
            </button>
            <div className="max-h-28 overflow-y-auto space-y-1">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => void loadSessionMessages(s.id)}
                  className="w-full text-left px-2 py-1.5 rounded-md text-xs"
                  style={{
                    background: sessionId === s.id ? 'var(--accent-soft)' : 'transparent',
                    color: 'var(--text)',
                    border: `1px solid ${sessionId === s.id ? 'var(--accent-glow)' : 'transparent'}`,
                  }}
                >
                  <div className="truncate font-medium">{s.title || 'New conversation'}</div>
                </button>
              ))}
              {sessions.length === 0 && (
                <p className="text-xs px-1" style={{ color: 'var(--text-secondary)' }}>No conversations yet.</p>
              )}
            </div>
          </div>
        )}

        <div className="px-3 py-2 border-b flex items-center gap-1.5" style={{ borderColor: 'var(--border)' }}>
          {(['ask', 'do', 'suggest', 'review'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase"
              style={{
                background: mode === m ? 'var(--accent)' : 'var(--surface-2)',
                color: mode === m ? '#fff' : 'var(--text-secondary)',
              }}
            >
              {m}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => filePickerRef.current?.click()}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            <Upload size={11} /> Upload
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--accent-soft)' }}>
                <WandSparkles size={22} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>AI Assistant</p>
              <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
                Daily assistant for OPENY OS with real actions and confirmations.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5 max-w-xs">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s}-${i}`}
                    onClick={() => handleSuggestion(s)}
                    className="px-2.5 py-1 rounded-full text-[11px]"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[88%]">
                  {isUser ? (
                    <div className="px-3 py-2 rounded-2xl rounded-br-sm text-sm" style={{ background: 'var(--accent)', color: '#fff' }}>
                      {msg.content}
                    </div>
                  ) : (
                    <div
                      className="px-3 py-2.5 rounded-2xl rounded-tl-sm text-sm"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">{statusIcon(msg.status)}</span>
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      </div>
                    </div>
                  )}

                  {!isUser && msg.needsConfirmation && msg.pendingAction && (
                    <div className="mt-2 p-2 rounded-xl" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                      {msg.matchedClients && msg.matchedClients.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {msg.matchedClients.map(c => (
                            <span
                              key={c.id}
                              className="px-2 py-0.5 rounded-full text-[10px]"
                              style={{ background: 'var(--accent-soft)', color: 'var(--text-secondary)' }}
                            >
                              {c.name} ({Math.round(c.score * 100)}%)
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <button
                          className="flex-1 h-8 rounded-lg text-xs font-semibold"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                          onClick={() => void sendMessage('', msg.pendingAction, true)}
                        >
                          نفّذ الآن
                        </button>
                        <button
                          className="flex-1 h-8 rounded-lg text-xs font-semibold"
                          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                          onClick={() => setInput(msg.content)}
                        >
                          تعديل
                        </button>
                        <button
                          className="flex-1 h-8 rounded-lg text-xs font-semibold"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                          onClick={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}

                  {!isUser && msg.actionsTaken && msg.actionsTaken.length > 0 && (
                    <div className="mt-2 p-2 rounded-xl" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
                      {msg.actionsTaken.map((action, i) => (
                        <p key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>• {action}</p>
                      ))}
                    </div>
                  )}

                  {!isUser && msg.openUrl && (
                    <button
                      className="mt-2 px-2.5 h-7 rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                      style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
                      onClick={() => window.location.assign(msg.openUrl!)}
                    >
                      Open <ExternalLink size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {uploadDraft && (
            <div className="p-2.5 rounded-xl" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>
                Upload Assistant · {uploadDraft.files.length} file(s)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <select
                  value={uploadDraft.clientId}
                  onChange={(e) => {
                    const selected = clients.find(c => c.id === e.target.value);
                    setUploadDraft(prev => prev ? { ...prev, clientId: e.target.value, clientName: selected?.name ?? '' } : prev);
                  }}
                  className="h-8 px-2 rounded-lg text-xs"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <select
                  value={uploadDraft.mainCategory}
                  onChange={(e) => {
                    const main = e.target.value;
                    const firstSub = SUBCATEGORIES[main as keyof typeof SUBCATEGORIES]?.[0]?.slug ?? '';
                    setUploadDraft(prev => prev ? { ...prev, mainCategory: main, subCategory: firstSub } : prev);
                  }}
                  className="h-8 px-2 rounded-lg text-xs"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  {MAIN_CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                </select>

                <select
                  value={uploadDraft.subCategory}
                  onChange={(e) => setUploadDraft(prev => prev ? { ...prev, subCategory: e.target.value } : prev)}
                  className="h-8 px-2 rounded-lg text-xs"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  <option value="">General</option>
                  {(SUBCATEGORIES[uploadDraft.mainCategory as keyof typeof SUBCATEGORIES] ?? []).map(s => (
                    <option key={s.slug} value={s.slug}>{s.label}</option>
                  ))}
                </select>

                <input
                  value={uploadDraft.monthKey}
                  onChange={(e) => setUploadDraft(prev => prev ? { ...prev, monthKey: e.target.value } : prev)}
                  className="h-8 px-2 rounded-lg text-xs"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  placeholder="YYYY-MM"
                />
              </div>

              <div className="flex gap-1.5">
                <button
                  className="flex-1 h-8 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                  onClick={runUpload}
                  disabled={!uploadDraft.clientName || !uploadDraft.mainCategory}
                >
                  ارفع الملفات
                </button>
                <button
                  className="flex-1 h-8 rounded-lg text-xs font-semibold"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                  onClick={() => setUploadDraft(null)}
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 size={13} className="animate-spin" /> Processing...
            </div>
          )}

          <div ref={messageEndRef} />
        </div>

        {messages.length > 0 && (
          <div className="px-3 py-2 border-t flex gap-1.5 overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            {suggestions.slice(0, 4).map((s, i) => (
              <button
                key={`${s}-${i}`}
                onClick={() => handleSuggestion(s)}
                className="px-2 py-1 rounded-full text-[11px] whitespace-nowrap"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-end gap-2 p-2 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => filePickerRef.current?.click()}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
            >
              <Upload size={14} />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="اكتب طلبك…"
              className="flex-1 bg-transparent text-sm resize-none outline-none max-h-[120px] min-h-[34px]"
              style={{ color: 'var(--text)' }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent)', color: '#fff', opacity: loading || !input.trim() ? 0.45 : 1 }}
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-[10px] text-center mt-1" style={{ color: 'var(--text-secondary)' }}>
            Enter to send · Shift+Enter newline · confirmations enabled
          </p>
        </form>

        <input
          ref={filePickerRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            onPickFiles(e.target.files);
            e.currentTarget.value = '';
          }}
        />
      </section>
    </>
  );
}
