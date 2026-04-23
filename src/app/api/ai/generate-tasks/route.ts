import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { callAI, AiUnconfiguredError } from '@/lib/ai-provider';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/ai/generate-tasks
 * Generate task suggestions for a client using Gemini.
 * Body: { clientId?: string, clientName?: string, description?: string, count?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'team_member', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const rl = checkRateLimit(`ai:user:${auth.profile.id}`, { limit: 30, windowMs: 60_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many AI requests. Please wait a moment.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
        },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { clientName, description, count = 5 } = body;
    if (!clientName && !description) {
      return NextResponse.json(
        { success: false, error: 'Provide clientName or description' },
        { status: 400 },
      );
    }

    const prompt = [
      description ? `Project description: ${description}` : '',
      clientName ? `Client: ${clientName}` : '',
      `Generate ${count} concrete, actionable task titles for a social media marketing agency.`,
      'Return a JSON array of strings, e.g. ["Task 1","Task 2"]. No extra text.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const raw = await callAI({
        system: 'You are a project manager assistant. Return only valid JSON arrays.',
        user: prompt,
        maxTokens: 512,
        temperature: 0.7,
      });

      let tasks: string[];
      try {
        tasks = JSON.parse(raw) as string[];
        if (!Array.isArray(tasks)) throw new Error('Not an array');
      } catch {
        // Fallback: split by newline
        tasks = raw
          .split('\n')
          .map((l) => l.replace(/^[\d\-\.\*]+\s*/, '').trim())
          .filter(Boolean);
      }

      return NextResponse.json({ success: true, tasks });
    } catch (aiErr: unknown) {
      if (aiErr instanceof AiUnconfiguredError) {
        return NextResponse.json(
          { success: false, error: 'AI features not configured. Set GEMINI_API_KEY.' },
          { status: 503 },
        );
      }
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
