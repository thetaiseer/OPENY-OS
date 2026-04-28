import { Resend } from 'resend';

type SendInviteEmailInput = {
  to: string;
  inviteUrl: string;
  workspaceName: string;
  role: string;
  inviterName?: string | null;
};

export async function sendInviteEmail({
  to,
  inviteUrl,
  workspaceName,
  role,
  inviterName,
}: SendInviteEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    'OPENY OS <noreply@openy-os.com>';
  const safeWorkspaceName = workspaceName || 'OPENY';
  const safeRole = role || 'member';
  const resend = new Resend(apiKey);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7fb;font-family:Inter,Arial,sans-serif;color:#111827;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="padding:24px 24px 8px 24px;">
        <h2 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;">You're invited to join OPENY OS</h2>
        <p style="margin:0 0 10px 0;font-size:14px;color:#4b5563;">
          You were invited to join <strong>${safeWorkspaceName}</strong>.
        </p>
        <p style="margin:0 0 10px 0;font-size:14px;color:#4b5563;">
          Invited email: <strong>${to}</strong>
        </p>
        <p style="margin:0 0 10px 0;font-size:14px;color:#4b5563;">
          Inviter: <strong>${inviterName ?? 'Workspace admin'}</strong>
        </p>
        <p style="margin:0 0 18px 0;font-size:14px;color:#4b5563;">
          Your role: <strong>${safeRole}</strong>
        </p>
        <a href="${inviteUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
          Accept Invitation
        </a>
      </div>
      <div style="padding:16px 24px 24px 24px;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#6b7280;">If the button doesn't work, use this link:</p>
        <p style="margin:0;font-size:12px;word-break:break-all;color:#2563eb;">${inviteUrl}</p>
      </div>
    </div>
  </body>
</html>`;

  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: "You're invited to join OPENY OS",
    html: html,
  });
  if (error) {
    throw new Error(error.message ?? 'Failed to send invite email');
  }
}
