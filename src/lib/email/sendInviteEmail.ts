import { teamInviteEmail, sendEmail } from '@/lib/email';

type SendInviteEmailInput = {
  to: string;
  inviteUrl: string;
  workspaceName: string;
  role: string;
  recipientName?: string;
  inviterName?: string | null;
};

export async function sendInviteEmail({
  to,
  inviteUrl,
  workspaceName,
  role,
  recipientName,
  inviterName,
}: SendInviteEmailInput): Promise<void> {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const html = teamInviteEmail({
    recipientName: recipientName ?? to,
    inviterName: inviterName ?? undefined,
    workspaceName,
    role,
    inviteUrl,
    expiresInDays: 7,
  });

  await sendEmail({
    to,
    subject: "You're invited to OPENY",
    html,
  });
}
