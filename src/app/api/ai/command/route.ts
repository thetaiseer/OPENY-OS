import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabase/service-client';
import { createNotification } from '@/lib/notification-service';

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
  'unknown',
]);

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
- If intent is create_task, rewrite task_title and description in professional English regardless of input language.
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

// ── Smart client matching ─────────────────────────────────────────────────────

async function findBestClientMatch(
  sb: Db,
  nameQuery: string
): Promise<{ id: string; name: string } | null> {
  const { data } = await sb
    .from('clients')
    .select('id, name')
    .order('name');

  if (!data?.length) return null;

  const q = nameQuery.toLowerCase().trim();

  // Exact match first
  const exact = data.find((c: { id: string; name: string }) => c.name.toLowerCase() === q);
  if (exact) return exact;

  // Contains match
  const contains = data.find((c: { id: string; name: string }) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
  if (contains) return contains;

  // Fuzzy: count common characters
  let bestScore = 0;
  let best: { id: string; name: string } | null = null;
  for (const client of data as { id: string; name: string }[]) {
    const name = client.name.toLowerCase();
    let score = 0;
    for (const ch of q) { if (name.includes(ch)) score++; }
    const normalized = score / Math.max(q.length, name.length);
    if (normalized > bestScore) { bestScore = normalized; best = client; }
  }

  return bestScore > 0.5 ? best : null;
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
    const client = await findBestClientMatch(sb, entities.client_name);
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
    const client = await findBestClientMatch(sb, entities.client_name);
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
  const client = await findBestClientMatch(sb, nameQuery);

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
    const client = await findBestClientMatch(sb, entities.client_name);
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
  const client = entities.client_name ? await findBestClientMatch(sb, entities.client_name) : null;
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

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: { message?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message } = body;
  if (!message?.trim()) {
    return NextResponse.json({ success: false, error: 'message is required' }, { status: 400 });
  }

  // Use UTC date consistently regardless of server timezone
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD UTC
  const systemPrompt = SYSTEM_PROMPT.replace('{TODAY}', today);

  try {
    // Step 1: Parse intent + entities
    const rawParsed = await callAI({
      system: systemPrompt,
      user: message,
      maxTokens: 1024,
      temperature: 0.2,
    });

    let parsed: ParsedCommand;
    try {
      const jsonStr = rawParsed.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr) as ParsedCommand;
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response',
        raw: rawParsed,
      }, { status: 500 });
    }

    // Step 2: If needs clarification, return question
    if (parsed.needs_clarification) {
      return NextResponse.json({
        success: true,
        needs_clarification: true,
        clarification_question: parsed.clarification_question,
        parsed,
      });
    }

    // Step 3: Guard — reject unknown intents before touching the database
    if (!ALLOWED_INTENTS.has(parsed.intent)) {
      logFailure(parsed.intent, 'Intent not in allowed list');
      return NextResponse.json({
        success: false,
        ok: false,
        error: `Intent "${parsed.intent}" is not supported.`,
        intent: parsed.intent,
        needs_clarification: false,
      });
    }

    // Step 4: Execute the safe action, wrapped in its own try/catch so a DB
    // error in one handler cannot crash the entire request or freeze the UI.
    const sb = getServiceClient() as Db;
    const userId = auth.profile.id;
    let result: ExecutionResult;

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
        case 'create_content_item': {
          let clientId: string | null = null;
          let clientName: string | null = null;
          if (parsed.entities.client_name) {
            const client = await findBestClientMatch(sb, parsed.entities.client_name);
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
            message: `Content item "${title}" created${clientName ? ` for ${clientName}` : ''}.`,
            data: data as Record<string, unknown>,
            actions_taken: [`Created content item: ${title}`],
          };
          break;
        }
        default:
          result = {
            success: false,
            message: "I didn't understand that command. Try asking me to create a task, schedule a post, search for a client, or invite a team member.",
            actions_taken: [],
          };
      }
    } catch (actionErr) {
      // Per-action error: log it and return a safe structured response.
      // This prevents UI freezing — the assistant panel shows the error message.
      logFailure(parsed.intent, actionErr);
      const errMsg = actionErr instanceof Error ? actionErr.message : String(actionErr);
      return NextResponse.json({
        ok: false,
        success: false,
        intent: parsed.intent,
        entities: parsed.entities,
        error: errMsg,
        message: `Action failed: ${errMsg}`,
        needs_clarification: false,
      });
    }

    return NextResponse.json({
      success: result.success,
      intent: parsed.intent,
      entities: parsed.entities,
      message: result.message,
      data: result.data,
      actions_taken: result.actions_taken,
      needs_clarification: false,
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
