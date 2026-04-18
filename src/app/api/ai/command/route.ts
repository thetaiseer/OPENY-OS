import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase/service-client';
import { createNotification } from '@/lib/notification-service';
import type { UserRole } from '@/lib/auth-context';

// Untyped schema client — we use string-keyed dynamic table access so schema inference isn't useful here
type Db = SupabaseClient<any>;


// ── Logging helpers ───────────────────────────────────────────────────────────

function logAction(intent: string, detail: string) {
  console.log(`[ai/command] ACTION intent=${intent} — ${detail}`);
}

function logFailure(intent: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[ai/command] FAILED intent=${intent} — ${msg}`);
}

// ── Safe action registry ──────────────────────────────────────────────────────
// Only intents listed here can be executed. All others return a graceful error.

const ALLOWED_INTENTS = new Set([
  'create_task',
  'update_task',
  'list_tasks',
  'search_client',
  'create_client',
  'update_client',
  'create_publishing_schedule',
  'create_content_item',
  'invite_team_member',
  'create_notification',
  'summarize_client_status',
  'summarize_workspace_status',
  'generate_content_ideas',
  // v3 new intents
  'create_project',
  'create_note',
  'start_timer',
  'stop_timer',
  'apply_template',
  'start_new_client_workflow',
  'prepare_month_workflow',
  'clean_workspace_workflow',
  'unknown',
]);

const MUTATING_INTENTS = new Set([
  'create_task',
  'update_task',
  'create_client',
  'update_client',
  'create_publishing_schedule',
  'create_content_item',
  'invite_team_member',
  'create_project',
  'create_note',
  'start_timer',
  'stop_timer',
  'start_new_client_workflow',
  'prepare_month_workflow',
  'clean_workspace_workflow',
]);

const ROLE_ORDER: Record<UserRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  team_member: 40,
  viewer: 10,
  client: 5,
};

const INTENT_MIN_ROLE: Partial<Record<string, UserRole>> = {
  invite_team_member: 'owner',
};

function hasIntentPermission(role: UserRole, intent: string): boolean {
  const min = INTENT_MIN_ROLE[intent];
  if (!min) return true;
  return (ROLE_ORDER[role] ?? 0) >= (ROLE_ORDER[min] ?? 999);
}

// Columns that are safe to select from the tasks table.
// This list reflects what the current schema actually has; never include
// speculative columns (e.g. client_name which may not exist).
const TASK_SAFE_COLUMNS = 'id, title, status, priority, due_date, client_id' as const;

// Columns allowed in a task INSERT payload.
const TASK_INSERT_ALLOWED_COLUMNS = new Set([
  'title',
  'description',
  'client_id',
  'priority',
  'status',
  'due_date',
  'due_time',
  'assignee_id',
  'created_by_id',
  'notes',
  'task_category',
  'content_purpose',
]);

/** Strip keys that are not in the whitelist to prevent unknown-column errors. */
function sanitizeTaskPayload(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).filter(([k]) => TASK_INSERT_ALLOWED_COLUMNS.has(k))
  );
}

// ── Intent & entity extraction ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are OPENY OS — a smart workspace AI that understands Arabic, English, and mixed casual language.

Your job is to parse user commands and return a structured JSON object. Never respond with plain text — always return valid JSON only.

Supported intents:
- create_task
- update_task
- list_tasks
- search_client
- create_client
- update_client
- upload_asset
- classify_asset
- create_publishing_schedule
- create_content_item
- invite_team_member
- create_notification
- summarize_client_status
- summarize_workspace_status
- generate_content_ideas
- create_project
- create_note
- start_timer
- stop_timer
- apply_template
- start_new_client_workflow
- prepare_month_workflow
- clean_workspace_workflow
- unknown

For dates: resolve relative dates (Monday = next Monday, الاثنين = next Monday) to ISO format YYYY-MM-DD. Today is {TODAY}.
For times: return HH:MM in 24h format.

Return JSON schema:
{
  "intent": "<one of the above>",
  "confidence": 0.0-1.0,
  "entities": {
    "client_name": string | null,
    "task_title": string | null,
    "task_description": string | null,
    "due_date": string | null,
    "due_time": string | null,
    "assignee": string | null,
    "priority": "low" | "medium" | "high" | null,
    "status": string | null,
    "post_type": string | null,
    "platforms": string[] | null,
    "content_type": string | null,
    "month": string | null,
    "year": string | null,
    "team_member_name": string | null,
    "email": string | null,
    "role": string | null,
    "count": number | null,
    "query": string | null
  },
  "professional_title": string | null,
  "professional_description": string | null,
  "needs_clarification": boolean,
  "clarification_question": string | null
}

Professional rewriting rules:
- Detect input language (Arabic or English) and keep rewrites in the same dominant language.
- Keep professional_title concise (max 8 words).
- Keep professional_description clear and actionable (1-2 sentences).`;

interface ParsedCommand {
  intent: string;
  confidence: number;
  entities: {
    client_name?: string | null;
    task_title?: string | null;
    task_description?: string | null;
    due_date?: string | null;
    due_time?: string | null;
    assignee?: string | null;
    priority?: string | null;
    status?: string | null;
    post_type?: string | null;
    platforms?: string[] | null;
    content_type?: string | null;
    month?: string | null;
    year?: string | null;
    team_member_name?: string | null;
    email?: string | null;
    role?: string | null;
    count?: number | null;
    query?: string | null;
  };
  professional_title?: string | null;
  professional_description?: string | null;
  needs_clarification: boolean;
  clarification_question?: string | null;
}

interface ExecutionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  actions_taken?: string[];
  error?: string;
}

interface PendingAction {
  intent: string;
  entities: ParsedCommand['entities'];
  professional_title?: string | null;
  professional_description?: string | null;
  confidence: number;
}

type ResponseLanguage = 'ar' | 'en';

type ClientMatch = {
  id: string;
  name: string;
  score: number;
};

const ARABIC_CHAR_RE = /[\u0600-\u06FF]/;
const ENGLISH_CHAR_RE = /[A-Za-z]/;

function detectLanguage(text: string): ResponseLanguage {
  const ar = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  if (ar === 0 && en === 0) return 'en';
  return ar >= en ? 'ar' : 'en';
}

function t(lang: ResponseLanguage, en: string, ar: string): string {
  return lang === 'ar' ? ar : en;
}

function normalizeSearchText(input: string): string {
  const arMap: Record<string, string> = {
    'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ئ': 'ي', 'ؤ': 'و', 'ة': 'ه',
  };
  const latinized = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  const arUnified = latinized.replace(/[أإآىئؤة]/g, ch => arMap[ch] ?? ch);
  return arUnified
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[_\-./\\()[\]{}:;,'"`~!@#$%^&*+=?|<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function simpleTransliteration(input: string): string {
  const map: Record<string, string> = {
    ا: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh',
    د: 'd', ذ: 'th', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's',
    ض: 'd', ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q',
    ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w', ي: 'y',
    ة: 'h', ى: 'a', ئ: 'y', ؤ: 'w',
  };
  return normalizeSearchText(input)
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1).fill(0);
  const v1 = new Array(b.length + 1).fill(0);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(
        v1[j] + 1,
        v0[j + 1] + 1,
        v0[j] + cost,
      );
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function similarityScore(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  if (candidate.includes(query) || query.includes(candidate)) return 0.92;
  const dist = levenshtein(query, candidate);
  const maxLen = Math.max(query.length, candidate.length);
  const levScore = maxLen > 0 ? 1 - dist / maxLen : 0;
  const qTokens = new Set(query.split(' ').filter(Boolean));
  const cTokens = new Set(candidate.split(' ').filter(Boolean));
  const overlap = [...qTokens].filter(t => cTokens.has(t)).length;
  const tokenScore = Math.max(qTokens.size, cTokens.size) > 0
    ? overlap / Math.max(qTokens.size, cTokens.size)
    : 0;
  return levScore * 0.7 + tokenScore * 0.3;
}

function actionPreview(parsed: ParsedCommand, lang: ResponseLanguage, bestClientName?: string | null): string {
  const e = parsed.entities;
  switch (parsed.intent) {
    case 'create_task':
      return t(
        lang,
        `I will create a task "${parsed.professional_title ?? e.task_title ?? 'New Task'}"${bestClientName ? ` for ${bestClientName}` : ''}${e.due_date ? ` due on ${e.due_date}` : ''}.`,
        `سأنشئ مهمة بعنوان "${parsed.professional_title ?? e.task_title ?? 'مهمة جديدة'}"${bestClientName ? ` للعميل ${bestClientName}` : ''}${e.due_date ? ` بتاريخ ${e.due_date}` : ''}.`,
      );
    case 'create_project':
      return t(
        lang,
        `I will create a project "${parsed.professional_title ?? e.task_title ?? 'New Project'}"${bestClientName ? ` for ${bestClientName}` : ''}.`,
        `سأنشئ مشروعًا بعنوان "${parsed.professional_title ?? e.task_title ?? 'مشروع جديد'}"${bestClientName ? ` للعميل ${bestClientName}` : ''}.`,
      );
    case 'create_client':
      return t(
        lang,
        `I will create a client "${parsed.professional_title ?? e.client_name ?? 'New Client'}".`,
        `سأنشئ عميلًا باسم "${parsed.professional_title ?? e.client_name ?? 'عميل جديد'}".`,
      );
    case 'create_content_item':
      return t(
        lang,
        `I will create a content item "${parsed.professional_title ?? e.task_title ?? 'New Content'}"${bestClientName ? ` for ${bestClientName}` : ''}.`,
        `سأنشئ عنصر محتوى بعنوان "${parsed.professional_title ?? e.task_title ?? 'محتوى جديد'}"${bestClientName ? ` للعميل ${bestClientName}` : ''}.`,
      );
    default:
      return t(lang, 'I will execute this action now.', 'سأنفذ هذا الإجراء الآن.');
  }
}

function shouldRequireConfirmation(parsed: ParsedCommand, hasClientAmbiguity: boolean): boolean {
  if (!MUTATING_INTENTS.has(parsed.intent)) return false;
  if (parsed.confidence < 0.78) return true;
  if (hasClientAmbiguity) return true;
  if (parsed.intent === 'create_task') {
    const missingTitle = !(parsed.professional_title ?? parsed.entities.task_title);
    const missingDueDate = !parsed.entities.due_date;
    return missingTitle || missingDueDate;
  }
  return false;
}

function localizeFailurePrefix(lang: ResponseLanguage): string {
  return t(lang, 'Action failed', 'فشل التنفيذ');
}

// ── Smart client matching ─────────────────────────────────────────────────────

async function findBestClientMatch(
  sb: Db,
  nameQuery: string
): Promise<{ best: ClientMatch | null; candidates: ClientMatch[] }> {
  const { data } = await sb
    .from('clients')
    .select('id, name')
    .order('name');

  if (!data?.length) return { best: null, candidates: [] };

  const q = normalizeSearchText(nameQuery);
  const qTrans = simpleTransliteration(nameQuery);
  const scored: ClientMatch[] = (data as { id: string; name: string }[])
    .map((client) => {
      const normalizedName = normalizeSearchText(client.name);
      const translitName = simpleTransliteration(client.name);
      const direct = similarityScore(q, normalizedName);
      const cross = similarityScore(qTrans, translitName);
      const hasArabicBridge = ARABIC_CHAR_RE.test(nameQuery) !== ARABIC_CHAR_RE.test(client.name)
        || ENGLISH_CHAR_RE.test(nameQuery) !== ENGLISH_CHAR_RE.test(client.name);
      const bridgeBoost = hasArabicBridge ? 0.03 : 0;
      return {
        id: client.id,
        name: client.name,
        score: Math.min(1, Math.max(direct, cross) + bridgeBoost),
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.score >= 0.58 ? scored[0] : null;
  const candidates = scored.filter(c => c.score >= 0.45).slice(0, 5);
  return { best, candidates };
}

// ── Action executors ──────────────────────────────────────────────────────────

async function executeCreateTask(
  sb: Db,
  parsed: ParsedCommand,
  userId: string
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const actions: string[] = [];

  // Resolve client
  let clientId: string | null = null;
  let clientName: string | null = null;
  if (entities.client_name) {
    const { best: client } = await findBestClientMatch(sb, entities.client_name);
    if (client) { clientId = client.id; clientName = client.name; }
  }

  const title = parsed.professional_title ?? entities.task_title ?? 'New Task';
  const description = parsed.professional_description ?? entities.task_description ?? null;

  // Only include columns that are confirmed to exist in the tasks table.
  // client_name is intentionally excluded — use client_id (FK) only.
  const rawPayload: Record<string, unknown> = {
    title,
    description,
    client_id: clientId,
    priority: entities.priority ?? 'medium',
    status: 'todo',
    due_date: entities.due_date ?? null,
    due_time: entities.due_time ?? null,
    created_by_id: userId,
  };
  const taskPayload = sanitizeTaskPayload(rawPayload);

  logAction('create_task', `title="${title}" client_id=${clientId ?? 'none'}`);
  const { data: task, error } = await sb.from('tasks').insert(taskPayload).select().single();
  if (error) throw new Error(error.message);

  actions.push(`Created task: "${title}"`);
  if (clientName) actions.push(`Linked to client: ${clientName}`);

  // Create activity log
  void sb.from('activities').insert({
    type: 'task_created',
    description: `AI created task: ${title}`,
    entity_type: 'task',
    entity_id: (task as { id: string }).id,
    user_id: userId,
    client_id: clientId,
  });

  // Create notification
  void createNotification({
    title: `Task Created: ${title}`,
    message: `AI Assistant created task: "${title}"`,
    type: 'success',
    user_id: userId,
    client_id: clientId ?? null,
    entity_type: 'task',
    entity_id: (task as { id: string }).id,
    action_url: `/tasks`,
  });

  return {
    success: true,
    message: `Task created successfully${clientName ? ` for ${clientName}` : ''}.`,
    data: task as Record<string, unknown>,
    actions_taken: actions,
  };
}

async function executeListTasks(
  sb: Db,
  parsed: ParsedCommand,
): Promise<ExecutionResult> {
  const { entities } = parsed;
  // Use only confirmed-safe columns — client_name is excluded to avoid missing-column errors.
  let query = sb.from('tasks').select(TASK_SAFE_COLUMNS).order('due_date', { ascending: true });

  if (entities.status) query = query.eq('status', entities.status);
  if (entities.client_name) {
    const { best: client } = await findBestClientMatch(sb, entities.client_name);
    if (client) query = query.eq('client_id', client.id);
  }

  // overdue filter
  const isOverdue = entities.query?.includes('متأخر') || entities.query?.includes('overdue') || entities.status === 'overdue';
  if (isOverdue) {
    query = query.lt('due_date', new Date().toISOString().split('T')[0]).neq('status', 'completed');
  }

  logAction('list_tasks', `status=${entities.status ?? 'any'} overdue=${isOverdue}`);
  const { data, error } = await query.limit(20);
  if (error) throw new Error(error.message);

  return {
    success: true,
    message: `Found ${data?.length ?? 0} tasks.`,
    data: { tasks: data },
    actions_taken: [`Listed ${data?.length ?? 0} tasks`],
  };
}

async function executeSearchClient(
  sb: Db,
  parsed: ParsedCommand,
): Promise<ExecutionResult> {
  const nameQuery = parsed.entities.client_name ?? parsed.entities.query ?? '';
  logAction('search_client', `query="${nameQuery}"`);
  const { best: client } = await findBestClientMatch(sb, nameQuery);

  if (!client) {
    return { success: false, message: `No client found matching "${nameQuery}".`, actions_taken: [] };
  }

  const { data } = await sb.from('clients').select('*').eq('id', client.id).single();

  return {
    success: true,
    message: `Found client: ${client.name}`,
    data: data as Record<string, unknown>,
    actions_taken: [`Found client: ${client.name}`],
  };
}

async function executeCreateClient(
  sb: Db,
  parsed: ParsedCommand,
  userId: string
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const name = parsed.professional_title ?? entities.client_name;
  if (!name) throw new Error('Client name is required');

  logAction('create_client', `name="${name}"`);
  const { data, error } = await sb.from('clients').insert({
    name,
    email: entities.email ?? null,
    created_by: userId,
  }).select().single();

  if (error) throw new Error(error.message);

  return {
    success: true,
    message: `Client "${name}" created successfully.`,
    data: data as Record<string, unknown>,
    actions_taken: [`Created client: ${name}`],
  };
}

async function executeUpdateTask(
  sb: Db,
  parsed: ParsedCommand,
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const actions: string[] = [];

  // Find the task to update — require either a title query or a status filter
  const searchTitle = entities.task_title ?? entities.query;
  if (!searchTitle) {
    return {
      success: false,
      message: 'Please specify which task you want to update (e.g. its title).',
      actions_taken: [],
    };
  }

  logAction('update_task', `search="${searchTitle}"`);

  // Find the task by partial title match
  const { data: tasks, error: findErr } = await sb
    .from('tasks')
    .select('id, title, status')
    .ilike('title', `%${searchTitle}%`)
    .limit(1);

  if (findErr) throw new Error(findErr.message);
  if (!tasks?.length) {
    return {
      success: false,
      message: `No task found matching "${searchTitle}".`,
      actions_taken: [],
    };
  }

  const taskId = (tasks[0] as { id: string }).id;
  const taskTitle = (tasks[0] as { id: string; title: string }).title;

  // Build update payload — only include recognised, safe columns
  const updatePayload: Record<string, unknown> = {};
  if (entities.status) updatePayload.status = entities.status;
  if (entities.priority) updatePayload.priority = entities.priority;
  if (entities.due_date) updatePayload.due_date = entities.due_date;
  if (entities.due_time) updatePayload.due_time = entities.due_time;
  if (parsed.professional_title) updatePayload.title = parsed.professional_title;
  if (parsed.professional_description) updatePayload.description = parsed.professional_description;

  if (!Object.keys(updatePayload).length) {
    return {
      success: false,
      message: 'Nothing to update. Please specify a new status, priority, or due date.',
      actions_taken: [],
    };
  }

  const { error: updateErr } = await sb
    .from('tasks')
    .update(updatePayload)
    .eq('id', taskId);

  if (updateErr) throw new Error(updateErr.message);

  for (const [k, v] of Object.entries(updatePayload)) {
    actions.push(`Updated ${k} → ${String(v)} on task "${taskTitle}"`);
  }

  return {
    success: true,
    message: `Task "${taskTitle}" updated successfully.`,
    data: { id: taskId, title: taskTitle, ...updatePayload },
    actions_taken: actions,
  };
}

async function executeCreatePublishingSchedule(
  sb: Db,
  parsed: ParsedCommand,
  userId: string
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const actions: string[] = [];

  let clientId: string | null = null;
  let clientName: string | null = null;
  if (entities.client_name) {
    const { best: client } = await findBestClientMatch(sb, entities.client_name);
    if (client) { clientId = client.id; clientName = client.name; }
  }

  const platforms = entities.platforms ?? ['Instagram'];
  const contentTitle = parsed.professional_title ?? entities.task_title ?? 'AI Scheduled Post';
  logAction('create_publishing_schedule', `title="${contentTitle}" platforms=${platforms.join(',')}`);

  // Create a content item first
  const { data: contentItem, error: contentError } = await sb.from('content_items').insert({
    title: contentTitle,
    description: parsed.professional_description ?? entities.task_description ?? null,
    client_id: clientId,
    post_type: entities.post_type ?? 'post',
    status: 'draft',
    created_by_id: userId,
  }).select().single();

  if (contentError) throw new Error(contentError.message);
  actions.push(`Created content item: "${contentTitle}"`);

  // Create publishing schedule for each platform
  const schedules = [];
  for (const platform of platforms) {
    const scheduledAt = entities.due_date
      ? `${entities.due_date}T${entities.due_time ?? '09:00'}:00`
      : new Date(Date.now() + 86400000).toISOString();

    const { data: schedule, error: schedErr } = await sb.from('publishing_schedules').insert({
      content_item_id: (contentItem as { id: string }).id,
      client_id: clientId,
      platform,
      scheduled_at: scheduledAt,
      status: 'scheduled',
      created_by: userId,
    }).select().single();

    if (schedErr) throw new Error(schedErr.message);
    schedules.push(schedule);
    actions.push(`Scheduled on ${platform} for ${scheduledAt}`);
  }

  // Create calendar event
  void sb.from('calendar_events').insert({
    title: contentTitle,
    start_date: entities.due_date ?? new Date().toISOString().split('T')[0],
    client_id: clientId,
    event_type: 'publishing',
    description: `Publishing: ${platforms.join(', ')}`,
    created_by_id: userId,
  });
  actions.push('Added to calendar');

  // Notification
  void createNotification({
    title: `Publishing Scheduled: ${contentTitle}`,
    message: `AI scheduled "${contentTitle}" on ${platforms.join(', ')}`,
    type: 'success',
    user_id: userId,
    client_id: clientId ?? null,
    entity_type: 'publishing_schedule',
    entity_id: (schedules[0] as { id: string })?.id,
    action_url: '/calendar',
  });

  return {
    success: true,
    message: `Publishing schedule created${clientName ? ` for ${clientName}` : ''} on ${platforms.join(', ')}.`,
    data: { content_item: contentItem, schedules },
    actions_taken: actions,
  };
}

async function executeInviteTeamMember(
  sb: Db,
  parsed: ParsedCommand,
  userId: string
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const email = entities.email;
  if (!email) throw new Error('Email is required to invite a team member');

  const name = entities.team_member_name ?? null;
  const role = entities.role ?? 'member';
  logAction('invite_team_member', `email="${email}" role=${role}`);

  // Generate a token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await sb.from('team_invitations').insert({
    email,
    name,
    role,
    token,
    invited_by: userId,
    expires_at: expiresAt,
    status: 'pending',
  }).select().single();

  if (error) throw new Error(error.message);

  return {
    success: true,
    message: `Invitation sent to ${email}${name ? ` (${name})` : ''} as ${role}.`,
    data: data as Record<string, unknown>,
    actions_taken: [`Invited ${email} as ${role}`],
  };
}

async function executeSummarizeClientStatus(
  sb: Db,
  parsed: ParsedCommand,
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const client = entities.client_name ? (await findBestClientMatch(sb, entities.client_name)).best : null;
  logAction('summarize_client_status', `client=${client?.name ?? 'workspace'}`);

  let tasksQuery = sb.from('tasks').select('title, status, priority, due_date').order('due_date');
  if (client) tasksQuery = tasksQuery.eq('client_id', client.id);

  const { data: tasks } = await tasksQuery.limit(50);

  const total = tasks?.length ?? 0;
  const completed = tasks?.filter((t: { status: string }) => t.status === 'completed').length ?? 0;
  const overdue = tasks?.filter((t: { due_date: string; status: string }) =>
    t.due_date && t.due_date < new Date().toISOString().split('T')[0] && t.status !== 'completed'
  ).length ?? 0;

  const summary = `${client ? `Client: ${client.name}` : 'Workspace'} — ${total} tasks total, ${completed} completed, ${overdue} overdue.`;

  return {
    success: true,
    message: summary,
    data: { total, completed, overdue, tasks },
    actions_taken: ['Summarized status'],
  };
}

async function executeGenerateContentIdeas(
  parsed: ParsedCommand,
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const count = entities.count ?? 3;
  const clientName = entities.client_name ?? 'the client';
  const contentType = entities.content_type ?? entities.post_type ?? 'Reels';
  logAction('generate_content_ideas', `count=${count} type=${contentType} client="${clientName}"`);

  const ideas = await callAI({
    system: 'You are a creative social media strategist. Generate concise, actionable content ideas.',
    user: `Generate ${count} ${contentType} content ideas for ${clientName}. Return as a numbered list. Be specific and creative.`,
    maxTokens: 512,
    temperature: 0.9,
  });

  return {
    success: true,
    message: `Generated ${count} ${contentType} ideas for ${clientName}`,
    data: { ideas, client_name: clientName, content_type: contentType },
    actions_taken: [`Generated ${count} ${contentType} ideas`],
  };
}

// ── v3 workflow executors ─────────────────────────────────────────────────────

async function executeCreateProject(
  sb: Db,
  parsed: ParsedCommand,
  userId: string
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const actions: string[] = [];

  let clientId: string | null = null;
  let clientName: string | null = null;
  if (entities.client_name) {
    const { best: client } = await findBestClientMatch(sb, entities.client_name);
    if (client) { clientId = client.id; clientName = client.name; }
  }

  const name = parsed.professional_title ?? entities.task_title ?? 'New Project';
  logAction('create_project', `name="${name}" client="${clientName ?? 'none'}"`);

  const { data, error } = await sb.from('projects').insert({
    name,
    description: parsed.professional_description ?? entities.task_description ?? null,
    client_id:   clientId,
    status:      'active',
    created_by:  userId,
  }).select().single();

  if (error) throw new Error(error.message);
  actions.push(`Created project: "${name}"`);
  if (clientName) actions.push(`Linked to client: ${clientName}`);

  void sb.from('activities').insert({
    type:        'project_created',
    description: `AI created project: ${name}`,
    entity_type: 'project',
    entity_id:   (data as { id: string }).id,
    user_uuid:   userId,
    client_id:   clientId,
  });

  return {
    success: true,
    message: `Project "${name}" created successfully${clientName ? ` for ${clientName}` : ''}.`,
    data: data as Record<string, unknown>,
    actions_taken: actions,
  };
}

async function executeCreateNote(
  sb: Db,
  parsed: ParsedCommand,
  userId: string
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const title = parsed.professional_title ?? entities.task_title ?? 'New Note';
  logAction('create_note', `title="${title}"`);

  const { data, error } = await sb.from('notes').insert({
    title,
    content:    parsed.professional_description ?? entities.task_description ?? null,
    created_by: userId,
  }).select().single();

  if (error) throw new Error(error.message);

  return {
    success: true,
    message: `Note "${title}" created.`,
    data: data as Record<string, unknown>,
    actions_taken: [`Created note: "${title}"`],
  };
}

async function executeStartTimer(
  sb: Db,
  parsed: ParsedCommand,
  userId: string
): Promise<ExecutionResult> {
  const { entities } = parsed;

  // Stop any running timer for this user first
  await sb.from('time_entries')
    .update({ is_running: false, ended_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_running', true);

  let taskId: string | null = null;
  if (entities.task_title) {
    const { data: tasks } = await sb.from('tasks').select('id').ilike('title', `%${entities.task_title}%`).limit(1);
    if (tasks?.length) taskId = (tasks[0] as { id: string }).id;
  }

  let clientId: string | null = null;
  if (entities.client_name) {
    const { best: client } = await findBestClientMatch(sb, entities.client_name);
    if (client) clientId = client.id;
  }

  logAction('start_timer', `task_id=${taskId ?? 'none'}`);

  const { data, error } = await sb.from('time_entries').insert({
    task_id:    taskId,
    client_id:  clientId,
    user_id:    userId,
    description: entities.task_description ?? null,
    started_at: new Date().toISOString(),
    is_running: true,
  }).select().single();

  if (error) throw new Error(error.message);

  return {
    success: true,
    message: 'Timer started.',
    data: data as Record<string, unknown>,
    actions_taken: ['Started time tracking timer'],
  };
}

async function executeStopTimer(
  sb: Db,
  userId: string
): Promise<ExecutionResult> {
  logAction('stop_timer', `user=${userId}`);
  const endedAt = new Date().toISOString();

  const { data: running } = await sb
    .from('time_entries')
    .select('id, started_at')
    .eq('user_id', userId)
    .eq('is_running', true)
    .single();

  if (!running) {
    return { success: false, message: 'No running timer found.', actions_taken: [] };
  }

  const durationSeconds = Math.round(
    (new Date(endedAt).getTime() - new Date((running as { started_at: string }).started_at).getTime()) / 1000,
  );

  const { error } = await sb.from('time_entries').update({
    is_running:       false,
    ended_at:         endedAt,
    duration_seconds: durationSeconds,
  }).eq('id', (running as { id: string }).id);

  if (error) throw new Error(error.message);

  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;
  return {
    success: true,
    message: `Timer stopped. Duration: ${mins}m ${secs}s.`,
    data: { duration_seconds: durationSeconds, mins, secs },
    actions_taken: [`Stopped timer after ${mins}m ${secs}s`],
  };
}

async function executeStartNewClientWorkflow(
  sb: Db,
  parsed: ParsedCommand,
  userId: string
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const clientName = entities.client_name ?? parsed.professional_title ?? 'New Client';
  const actions: string[] = [];
  logAction('start_new_client_workflow', `client="${clientName}"`);

  // 1. Create client
  const { data: client, error: cErr } = await sb.from('clients').insert({
    name:       clientName,
    email:      entities.email ?? null,
    status:     'active',
    created_by: userId,
  }).select().single();
  if (cErr) throw new Error(cErr.message);
  actions.push(`Created client: ${clientName}`);
  const clientId = (client as { id: string }).id;

  // 2. Create onboarding project
  const { data: project } = await sb.from('projects').insert({
    name:       `${clientName} — Onboarding`,
    client_id:  clientId,
    status:     'active',
    created_by: userId,
  }).select().single();
  if (project) actions.push('Created onboarding project');

  // 3. Create default onboarding tasks
  const defaultTasks = [
    { title: 'Client Kickoff Call', priority: 'high', status: 'todo' },
    { title: 'Collect Brand Assets', priority: 'medium', status: 'todo' },
    { title: 'Set Up Client Workspace', priority: 'medium', status: 'todo' },
  ];
  const projectId = project ? (project as { id: string }).id : null;
  for (const task of defaultTasks) {
    await sb.from('tasks').insert({
      ...task,
      client_id:    clientId,
      project_id:   projectId,
      created_by_id: userId,
      due_date:     new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    });
  }
  actions.push(`Created ${defaultTasks.length} onboarding tasks`);

  // 4. Create welcome note
  await sb.from('notes').insert({
    title:       `${clientName} — Welcome Brief`,
    content:     `Welcome brief for ${clientName}.\n\nAdd goals, brand guidelines, and key contacts here.`,
    entity_type: 'client',
    entity_id:   clientId,
    created_by:  userId,
  });
  actions.push('Created welcome brief note');

  void sb.from('activities').insert({
    type:        'client_created',
    description: `AI onboarded client: ${clientName}`,
    entity_type: 'client',
    entity_id:   clientId,
    user_uuid:   userId,
    client_id:   clientId,
  });

  return {
    success: true,
    message: `Client "${clientName}" onboarded! Created project, ${defaultTasks.length} tasks, and a welcome brief.`,
    data: { client, project },
    actions_taken: actions,
  };
}

async function executePrepareMonthWorkflow(
  sb: Db,
  parsed: ParsedCommand,
  userId: string
): Promise<ExecutionResult> {
  const { entities } = parsed;
  const actions: string[] = [];
  logAction('prepare_month_workflow', `month=${entities.month ?? 'current'}`);

  // Get all active clients
  const { data: clients } = await sb.from('clients').select('id, name').eq('status', 'active').limit(20);
  if (!clients?.length) {
    return { success: false, message: 'No active clients found.', actions_taken: [] };
  }

  // Compute next month
  const now = new Date();
  const targetMonth = entities.month
    ? new Date(`${entities.month} 1, ${entities.year ?? now.getFullYear()}`)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthStr  = targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const monthKey  = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`;
  const dueDate   = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).toISOString().split('T')[0];

  let taskCount = 0;
  for (const c of clients as { id: string; name: string }[]) {
    // Create monthly planning task for each client
    const { error } = await sb.from('tasks').insert({
      title:        `${c.name} — ${monthStr} Content Plan`,
      description:  `Plan and schedule all content for ${c.name} in ${monthStr}.`,
      client_id:    c.id,
      status:       'todo',
      priority:     'medium',
      due_date:     dueDate,
      created_by_id: userId,
    });
    if (!error) taskCount++;
  }
  actions.push(`Created ${taskCount} monthly planning tasks`);

  // Create a workspace-level planning note
  await sb.from('notes').insert({
    title:      `${monthStr} — Monthly Plan`,
    content:    `Monthly content and project plan for ${monthStr}.\n\nClients: ${clients.map((c: { name: string }) => c.name).join(', ')}`,
    created_by: userId,
  });
  actions.push('Created monthly plan note');

  return {
    success: true,
    message: `Month prepared: created ${taskCount} planning tasks for ${clients.length} clients and a monthly plan note.`,
    data: { month: monthStr, month_key: monthKey, client_count: clients.length, task_count: taskCount },
    actions_taken: actions,
  };
}

async function executeCleanWorkspaceWorkflow(
  sb: Db,
  userId: string
): Promise<ExecutionResult> {
  const actions: string[] = [];
  const issues: string[] = [];
  logAction('clean_workspace_workflow', `user=${userId}`);

  // 1. Find overdue tasks
  const today = new Date().toISOString().split('T')[0];
  const { data: overdueTasks } = await sb
    .from('tasks')
    .select('id, title, due_date')
    .lt('due_date', today)
    .not('status', 'in', '("completed","cancelled","overdue")')
    .limit(50);

  if (overdueTasks?.length) {
    const ids = (overdueTasks as { id: string }[]).map(t => t.id);
    await sb.from('tasks').update({ status: 'overdue' }).in('id', ids);
    issues.push(`${overdueTasks.length} overdue tasks marked`);
    actions.push(`Marked ${overdueTasks.length} tasks as overdue`);
  }

  // 2. Find tasks without due dates (warn only — count only, head: true avoids fetching rows)
  const { count: noDueDateCount } = await sb
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .is('due_date', null)
    .not('status', 'in', '("completed","cancelled")');

  if ((noDueDateCount ?? 0) > 0) {
    issues.push(`${noDueDateCount} tasks missing a due date`);
  }

  const message = issues.length > 0
    ? `Workspace cleaned. Issues found: ${issues.join('; ')}.`
    : 'Workspace is clean — no issues found!';

  return {
    success: true,
    message,
    data: { issues, overdue_count: overdueTasks?.length ?? 0, no_due_date_count: noDueDateCount ?? 0 },
    actions_taken: actions.length > 0 ? actions : ['Workspace audit completed'],
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: {
    message?: string;
    confirm_action?: boolean;
    pending_action?: PendingAction;
    session_id?: string;
    context?: { mode?: string; section?: string; clientContext?: { id?: string; name?: string } };
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = body.message?.trim() ?? '';
  const lang = detectLanguage(message || JSON.stringify(body.pending_action ?? ''));
  const userId = auth.profile.id;
  const sb = getServiceClient() as Db;

  if (!message && !body.pending_action) {
    return NextResponse.json({ success: false, error: t(lang, 'message is required', 'الرسالة مطلوبة') }, { status: 400 });
  }

  let sessionId = body.session_id?.trim() || '';
  if (sessionId) {
    const { data: existingSession } = await sb
      .from('ai_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!existingSession) sessionId = '';
  }
  if (!sessionId) {
    const { data: newSession } = await sb.from('ai_sessions').insert({
      user_id: userId,
      mode: (body.context?.mode as string | undefined) ?? 'ask',
      section: body.context?.section ?? null,
      entity_type: body.context?.clientContext?.id ? 'client' : null,
      entity_id: body.context?.clientContext?.id ?? null,
    }).select('id').single();
    sessionId = (newSession as { id?: string } | null)?.id ?? '';
  }

  // Use UTC date consistently regardless of server timezone
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC
  const systemPrompt = SYSTEM_PROMPT.replace('{TODAY}', today);

  try {
    let parsed: ParsedCommand;
    if (body.pending_action && body.confirm_action) {
      parsed = {
        intent: body.pending_action.intent,
        confidence: body.pending_action.confidence,
        entities: body.pending_action.entities,
        professional_title: body.pending_action.professional_title ?? null,
        professional_description: body.pending_action.professional_description ?? null,
        needs_clarification: false,
      };
    } else {
      const rawParsed = await callAI({
        system: systemPrompt,
        user: message,
        maxTokens: 1024,
        temperature: 0.2,
      });
      try {
        const jsonStr = rawParsed.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(jsonStr) as ParsedCommand;
      } catch {
        return NextResponse.json({
          success: false,
          error: t(lang, 'Failed to parse AI response', 'فشل تحليل استجابة الذكاء الاصطناعي'),
          raw: rawParsed,
          session_id: sessionId || null,
        }, { status: 500 });
      }
    }

    if (!ALLOWED_INTENTS.has(parsed.intent)) {
      logFailure(parsed.intent, 'Intent not in allowed list');
      return NextResponse.json({
        success: false,
        error: t(lang, `Intent "${parsed.intent}" is not supported.`, `الأمر "${parsed.intent}" غير مدعوم.`),
        intent: parsed.intent,
        needs_clarification: false,
        session_id: sessionId || null,
      });
    }

    if (!hasIntentPermission(auth.profile.role, parsed.intent)) {
      return NextResponse.json({
        success: false,
        error: t(lang, 'You do not have permission for this action.', 'ليس لديك صلاحية لتنفيذ هذا الإجراء.'),
        intent: parsed.intent,
        session_id: sessionId || null,
      }, { status: 403 });
    }

    if (parsed.needs_clarification) {
      return NextResponse.json({
        success: true,
        needs_clarification: true,
        clarification_question: parsed.clarification_question ?? t(lang, 'Could you clarify?', 'هل يمكنك توضيح الطلب؟'),
        parsed,
        session_id: sessionId || null,
        language: lang,
      });
    }

    let bestClient: ClientMatch | null = null;
    let clientCandidates: ClientMatch[] = [];
    if (parsed.entities.client_name) {
      const match = await findBestClientMatch(sb, parsed.entities.client_name);
      bestClient = match.best;
      clientCandidates = match.candidates;
      if (bestClient) parsed.entities.client_name = bestClient.name;
    }

    const hasClientAmbiguity =
      clientCandidates.length > 1 &&
      (clientCandidates[0].score - clientCandidates[1].score) < 0.08;

    if (!body.confirm_action && shouldRequireConfirmation(parsed, hasClientAmbiguity)) {
      const confirmationMessage = actionPreview(parsed, lang, bestClient?.name ?? null);
      void sb.from('ai_actions').insert({
        session_id: sessionId || null,
        user_id: userId,
        intent: parsed.intent,
        prompt: message || confirmationMessage,
        status: 'pending',
        response_text: confirmationMessage,
        actions_taken: [],
      });
      return NextResponse.json({
        success: true,
        needs_confirmation: true,
        confirmation_message: `${confirmationMessage} ${t(lang, 'Do you confirm?', 'هل تؤكد التنفيذ؟')}`,
        intent: parsed.intent,
        pending_action: {
          intent: parsed.intent,
          entities: parsed.entities,
          professional_title: parsed.professional_title ?? null,
          professional_description: parsed.professional_description ?? null,
          confidence: parsed.confidence,
        } satisfies PendingAction,
        matched_clients: clientCandidates.map(c => ({ id: c.id, name: c.name, score: Number(c.score.toFixed(3)) })),
        session_id: sessionId || null,
        language: lang,
      });
    }

    let result: ExecutionResult;
    const actionStartMs = Date.now();

    try {
      switch (parsed.intent) {
        case 'create_task':
          result = await executeCreateTask(sb, parsed, userId);
          break;
        case 'update_task':
          result = await executeUpdateTask(sb, parsed);
          break;
        case 'list_tasks':
          result = await executeListTasks(sb, parsed);
          break;
        case 'search_client':
          result = await executeSearchClient(sb, parsed);
          break;
        case 'create_client':
          result = await executeCreateClient(sb, parsed, userId);
          break;
        case 'create_publishing_schedule':
          result = await executeCreatePublishingSchedule(sb, parsed, userId);
          break;
        case 'invite_team_member':
          result = await executeInviteTeamMember(sb, parsed, userId);
          break;
        case 'summarize_client_status':
        case 'summarize_workspace_status':
          result = await executeSummarizeClientStatus(sb, parsed);
          break;
        case 'generate_content_ideas':
          result = await executeGenerateContentIdeas(parsed);
          break;
        case 'create_project':
          result = await executeCreateProject(sb, parsed, userId);
          break;
        case 'create_note':
          result = await executeCreateNote(sb, parsed, userId);
          break;
        case 'start_timer':
          result = await executeStartTimer(sb, parsed, userId);
          break;
        case 'stop_timer':
          result = await executeStopTimer(sb, userId);
          break;
        case 'start_new_client_workflow':
          result = await executeStartNewClientWorkflow(sb, parsed, userId);
          break;
        case 'prepare_month_workflow':
          result = await executePrepareMonthWorkflow(sb, parsed, userId);
          break;
        case 'clean_workspace_workflow':
          result = await executeCleanWorkspaceWorkflow(sb, userId);
          break;
        case 'create_content_item': {
          let clientId: string | null = null;
          let clientName: string | null = null;
          if (parsed.entities.client_name) {
            const { best: client } = await findBestClientMatch(sb, parsed.entities.client_name);
            if (client) { clientId = client.id; clientName = client.name; }
          }
          const title = parsed.professional_title ?? parsed.entities.task_title ?? 'New Content';
          logAction('create_content_item', `title="${title}"`);
          const { data, error } = await sb.from('content_items').insert({
            title,
            description: parsed.professional_description ?? parsed.entities.task_description ?? null,
            client_id: clientId,
            post_type: parsed.entities.post_type ?? 'post',
            status: 'draft',
            created_by_id: userId,
          }).select().single();
          if (error) throw new Error(error.message);
          result = {
            success: true,
            message: t(
              lang,
              `Content item "${title}" created${clientName ? ` for ${clientName}` : ''}.`,
              `تم إنشاء عنصر المحتوى "${title}"${clientName ? ` للعميل ${clientName}` : ''}.`,
            ),
            data: data as Record<string, unknown>,
            actions_taken: [t(lang, `Created content item: ${title}`, `تم إنشاء عنصر محتوى: ${title}`)],
          };
          break;
        }
        default:
          result = {
            success: false,
            message: t(
              lang,
              "I didn't understand that command. Try asking me to create a task, project, schedule a post, search for a client, or start a timer.",
              'لم أفهم الطلب. يمكنك طلب إنشاء مهمة أو مشروع أو البحث عن عميل أو بدء مؤقت.',
            ),
            actions_taken: [],
          };
      }
    } catch (actionErr) {
      logFailure(parsed.intent, actionErr);
      const errMsg = actionErr instanceof Error ? actionErr.message : String(actionErr);
      void (async () => {
        try {
          await sb.from('ai_actions').insert({
            session_id: sessionId || null,
            user_id: userId,
            intent: parsed.intent,
            prompt: message || JSON.stringify(body.pending_action ?? {}),
            status: 'error',
            error_message: errMsg,
            duration_ms: Date.now() - actionStartMs,
            actions_taken: [],
          });
        } catch { /* ignore */ }
      })();
      return NextResponse.json({
        success: false,
        intent: parsed.intent,
        entities: parsed.entities,
        error: errMsg,
        message: `${localizeFailurePrefix(lang)}: ${errMsg}`,
        needs_clarification: false,
        session_id: sessionId || null,
        language: lang,
      });
    }

    void (async () => {
      try {
        await sb.from('ai_actions').insert({
          session_id: sessionId || null,
          user_id: userId,
          intent: parsed.intent,
          prompt: message || JSON.stringify(body.pending_action ?? {}),
          status: result.success ? 'success' : 'partial',
          response_text: result.message,
          actions_taken: result.actions_taken ?? [],
          duration_ms: Date.now() - actionStartMs,
        });
      } catch { /* ignore */ }
    })();

    const openUrl = (() => {
      if (!result.success) return null;
      if (parsed.intent === 'create_task') return '/tasks/all';
      if (parsed.intent === 'create_project') return '/clients';
      if (parsed.intent === 'create_client') {
        const id = result.data?.id as string | undefined;
        return id ? `/clients/${id}/overview` : '/clients';
      }
      if (parsed.intent === 'create_content_item') return '/content';
      if (parsed.intent === 'search_client') {
        const id = result.data?.id as string | undefined;
        return id ? `/clients/${id}/overview` : '/clients';
      }
      return null;
    })();

    return NextResponse.json({
      success: result.success,
      intent: parsed.intent,
      entities: parsed.entities,
      message: result.message,
      data: result.data,
      actions_taken: result.actions_taken,
      needs_clarification: false,
      session_id: sessionId || null,
      language: lang,
      open_url: openUrl,
      matched_clients: clientCandidates.map(c => ({ id: c.id, name: c.name, score: Number(c.score.toFixed(3)) })),
    });
  } catch (err) {
    if (err instanceof AiUnconfiguredError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai/command] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
