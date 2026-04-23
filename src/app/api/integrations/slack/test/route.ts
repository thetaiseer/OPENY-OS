import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { sendSlackMessage } from '@/lib/slack';

/**
 * POST /api/integrations/slack/test
 * Send a test message to the configured Slack webhook.
 * Body: { webhookUrl: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const webhookUrl = (body.webhookUrl as string | undefined) ?? process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: 'webhookUrl is required or set SLACK_WEBHOOK_URL env var' },
      { status: 400 },
    );
  }

  try {
    await sendSlackMessage(webhookUrl, {
      text: '✅ OPENY OS: Slack integration test successful!',
      icon_emoji: ':white_check_mark:',
    });
    return NextResponse.json({ success: true, message: 'Test message sent to Slack' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 502 });
  }
}
