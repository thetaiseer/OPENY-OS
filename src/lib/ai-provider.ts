/**
 * src/lib/ai-provider.ts
 *
 * Unified AI text-generation helper.
 *
 * Provider priority:
 *   1. OPENAI_API_KEY  → OpenAI gpt-4o-mini
 *   2. GEMINI_API_KEY  → Google Gemini gemini-1.5-flash
 *
 * If neither key is set, throws AiUnconfiguredError (callers return HTTP 503).
 *
 * Usage:
 *   const text = await callAI({ system: '...', user: '...', maxTokens: 512, temperature: 0.7 });
 */

export class AiUnconfiguredError extends Error {
  constructor() {
    super('AI features are not configured. Set OPENAI_API_KEY or GEMINI_API_KEY to enable them.');
    this.name = 'AiUnconfiguredError';
  }
}

export interface AiCallOptions {
  /** System-role instruction (OpenAI) / prepended to user prompt (Gemini). */
  system: string;
  /** User-role prompt. */
  user: string;
  /** Maximum tokens to generate (default: 1024). */
  maxTokens?: number;
  /** Sampling temperature (default: 0.7). */
  temperature?: number;
}

/** Returns the trimmed text from the AI response. Throws on network / parse errors. */
export async function callAI({
  system,
  user,
  maxTokens = 1024,
  temperature = 0.7,
}: AiCallOptions): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (openaiKey) {
    return callOpenAI({ openaiKey, system, user, maxTokens, temperature });
  }

  if (geminiKey) {
    return callGemini({ geminiKey, system, user, maxTokens, temperature });
  }

  throw new AiUnconfiguredError();
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

async function callOpenAI({
  openaiKey,
  system,
  user,
  maxTokens,
  temperature,
}: {
  openaiKey: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = (err?.error as Record<string, unknown>)?.message ?? `OpenAI API error (HTTP ${res.status})`;
    throw new Error(String(msg));
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('No response from OpenAI');
  return text;
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function callGemini({
  geminiKey,
  system,
  user,
  maxTokens,
  temperature,
}: {
  geminiKey: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const errMsg =
      (err?.error as Record<string, unknown>)?.message ??
      `Gemini API error (HTTP ${res.status})`;
    throw new Error(String(errMsg));
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('No response from Gemini');
  return text;
}
