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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://openy-os.com';
  const logoUrl = `${appUrl}/branding/openy-marketing-agency-black.png`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>You're invited to join ${safeWorkspaceName}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

            <!-- Logo header -->
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <img src="${logoUrl}" alt="OPENY" width="120" height="auto" style="display:block;" />
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04);">

                <!-- Top accent bar -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#000000;padding:28px 36px;">
                      <p style="margin:0 0 6px 0;font-size:12px;font-weight:600;letter-spacing:0.08em;color:rgba(255,255,255,0.55);text-transform:uppercase;">Workspace Invitation</p>
                      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">You're invited to join<br/>${safeWorkspaceName}</h1>
                    </td>
                  </tr>
                </table>

                <!-- Body -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:32px 36px 28px 36px;">

                      <p style="margin:0 0 24px 0;font-size:15px;color:#52525b;line-height:1.6;">
                        ${inviterName ? `<strong style="color:#09090b;">${inviterName}</strong> has` : 'You have been'} invited you to collaborate on <strong style="color:#09090b;">${safeWorkspaceName}</strong> on OPENY OS.
                      </p>

                      <!-- Details box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border:1px solid #e4e4e7;border-radius:10px;margin-bottom:28px;">
                        <tr>
                          <td style="padding:20px 20px 4px 20px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding-bottom:14px;border-bottom:1px solid #e4e4e7;">
                                  <p style="margin:0 0 2px 0;font-size:11px;font-weight:600;letter-spacing:0.06em;color:#a1a1aa;text-transform:uppercase;">Invited email</p>
                                  <p style="margin:0;font-size:14px;font-weight:500;color:#09090b;">${to}</p>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding-top:14px;padding-bottom:14px;border-bottom:1px solid #e4e4e7;">
                                  <p style="margin:0 0 2px 0;font-size:11px;font-weight:600;letter-spacing:0.06em;color:#a1a1aa;text-transform:uppercase;">Invited by</p>
                                  <p style="margin:0;font-size:14px;font-weight:500;color:#09090b;">${inviterName ?? 'Workspace admin'}</p>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding-top:14px;">
                                  <p style="margin:0 0 2px 0;font-size:11px;font-weight:600;letter-spacing:0.06em;color:#a1a1aa;text-transform:uppercase;">Your role</p>
                                  <p style="margin:0;font-size:14px;font-weight:500;color:#09090b;text-transform:capitalize;">${safeRole}</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- CTA button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;background:#000000;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.01em;">
                              Accept Invitation &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>
                </table>

                <!-- Fallback link -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:16px 36px 28px 36px;border-top:1px solid #f4f4f5;">
                      <p style="margin:0 0 6px 0;font-size:12px;color:#a1a1aa;">If the button doesn't work, copy and paste this link into your browser:</p>
                      <p style="margin:0;font-size:12px;word-break:break-all;color:#52525b;">${inviteUrl}</p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="padding-top:24px;">
                <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                  This invitation was sent by OPENY OS &middot; <a href="${appUrl}" style="color:#71717a;text-decoration:none;">${appUrl.replace('https://', '')}</a><br/>
                  If you didn't expect this, you can ignore this email.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
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
