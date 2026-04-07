/**
 * Slack Incoming Webhook helper.
 * Configure the webhook URL in Supabase settings or via SLACK_WEBHOOK_URL env var.
 */

export interface SlackMessage {
  text: string;
  /** Optional override icon emoji, e.g. ":white_check_mark:" */
  icon_emoji?: string;
  /** Optional channel override (requires full webhook URL target) */
  channel?: string;
}

export async function sendSlackMessage(webhookUrl: string, msg: SlackMessage): Promise<void> {
  if (!webhookUrl) throw new Error('Slack webhook URL is not configured');

  const payload = {
    text: msg.text,
    ...(msg.icon_emoji ? { icon_emoji: msg.icon_emoji } : {}),
    ...(msg.channel ? { channel: msg.channel } : {}),
  };

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Slack webhook returned ${res.status}: ${body}`);
  }
}
