/**
 * Lightweight workflow AI helpers.
 * These are intentionally "invisible layer" APIs that can be called from
 * onChange/onBlur handlers without adding explicit AI buttons to the UI.
 */

type SuggestTaskInput = {
  workspaceId?: string | null;
  titleDraft: string;
  context?: string;
};

type SuggestDeadlineInput = {
  workspaceId?: string | null;
  title: string;
  description?: string;
  priority?: string;
};

type ImproveContentInput = {
  workspaceId?: string | null;
  text: string;
  tone?: 'neutral' | 'professional' | 'playful';
};

type ClientActivitySummaryInput = {
  workspaceId?: string | null;
  clientId: string;
  horizonDays?: number;
};

async function postJson<T>(url: string, payload: unknown): Promise<T | null> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export async function suggestTaskTitle(input: SuggestTaskInput): Promise<string | null> {
  if (!input.titleDraft.trim()) return null;
  const result = await postJson<{ suggestion?: string }>('/api/ai/generate-tasks', {
    workspace_id: input.workspaceId ?? null,
    draft: input.titleDraft,
    context: input.context ?? '',
  });
  return result?.suggestion?.trim() || null;
}

export async function suggestTaskDeadline(input: SuggestDeadlineInput): Promise<string | null> {
  if (!input.title.trim()) return null;
  const result = await postJson<{ due_date?: string }>('/api/ai/suggest-schedule', {
    workspace_id: input.workspaceId ?? null,
    title: input.title,
    description: input.description ?? '',
    priority: input.priority ?? 'medium',
  });
  return result?.due_date ?? null;
}

export async function improveContentOnBlur(input: ImproveContentInput): Promise<string | null> {
  if (!input.text.trim()) return null;
  const result = await postJson<{ content?: string }>('/api/ai/improve', {
    workspace_id: input.workspaceId ?? null,
    text: input.text,
    tone: input.tone ?? 'professional',
  });
  return result?.content?.trim() || null;
}

export async function summarizeClientActivity(
  input: ClientActivitySummaryInput,
): Promise<string | null> {
  const result = await postJson<{ summary?: string }>('/api/ai/summarize-report', {
    workspace_id: input.workspaceId ?? null,
    client_id: input.clientId,
    horizon_days: input.horizonDays ?? 14,
  });
  return result?.summary?.trim() || null;
}
