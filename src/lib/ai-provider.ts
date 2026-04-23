/**
 * src/lib/ai-provider.ts
 *
 * Gemini AI text-generation helper.
 *
 * Requires GEMINI_API_KEY. Reads GEMINI_MODEL env var for the model name
 * (default: gemini-2.5-flash).
 *
 * If GEMINI_API_KEY is not set, throws AiUnconfiguredError (callers return HTTP 503).
 *
 * Usage:
 *   const text = await callAI({ system: '...', user: '...', maxTokens: 512, temperature: 0.7 });
 */

export class AiUnconfiguredError extends Error {
  constructor() {
    super('AI features are not configured. Set GEMINI_API_KEY to enable them.');
    this.name = 'AiUnconfiguredError';
  }
}

export interface AiCallOptions {
  /** System-role instruction prepended to the user prompt. */
  system: string;
  /** User-role prompt. */
  user: string;
  /** Maximum tokens to generate (default: 1024). */
  maxTokens?: number;
  /** Sampling temperature (default: 0.7). */
  temperature?: number;
}

// ── Startup env check ─────────────────────────────────────────────────────────
// Runs once when this module is first imported (server startup).
{
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.warn('[ai] GEMINI_API_KEY is not set — AI features will return HTTP 503');
  }
}

/** Returns the trimmed text from the AI response. Throws on network / parse errors. */
export async function callAI({
  system,
  user,
  maxTokens = 1024,
  temperature = 0.7,
}: AiCallOptions): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    throw new AiUnconfiguredError();
  }

  return callGemini({ geminiKey, system, user, maxTokens, temperature });
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Maximum number of raw-body characters included in a non-JSON error message. */
const MAX_ERROR_BODY_LENGTH = 200;

/** Extract a human-readable message from an API error response body. */
function parseApiErrorMessage(err: Record<string, unknown>, fallback: string): string {
  const msg = (err?.error as Record<string, unknown>)?.message;
  return msg != null ? String(msg) : fallback;
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
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

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
    const rawBody = await res.text();
    console.error(`[Gemini] request failed — status ${res.status}`, rawBody);
    let errMsg: string;
    try {
      const err = JSON.parse(rawBody) as Record<string, unknown>;
      errMsg = parseApiErrorMessage(err, `Gemini API error (HTTP ${res.status})`);
    } catch {
      errMsg = `Gemini API error (HTTP ${res.status}): ${rawBody.slice(0, MAX_ERROR_BODY_LENGTH)}`;
    }
    throw new Error(errMsg);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text)
    throw new Error(
      'Gemini returned an empty response — no text in candidates[0].content.parts[0]',
    );
  return text;
}
