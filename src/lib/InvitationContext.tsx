"use client";

// ============================================================
// OPENY OS – Invitation Context (Firestore-backed)
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "./firebase";
import type { Invitation, InvitationStatus } from "./types";

// ── Helpers ───────────────────────────────────────────────────

const INVITATION_EXPIRY_DAYS = 7;

const PALETTE = ["#4f8ef7", "#a78bfa", "#34d399", "#fbbf24", "#f87171", "#8888a0"];
function pickColor() { return PALETTE[Math.floor(Math.random() * PALETTE.length)]; }
function makeInitials(name: string) {
  return name.split(" ").filter((w) => w.length > 0).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

/** Derive a display name from invitation fields, falling back to the email prefix. */
function deriveMemberName(inv: Pick<Invitation, "name" | "firstName" | "lastName" | "email">): string {
  if (inv.name) return inv.name;
  if (inv.firstName && inv.lastName) return `${inv.firstName} ${inv.lastName}`.trim();
  if (inv.firstName) return inv.firstName;
  if (inv.lastName) return inv.lastName;
  return inv.email.split("@")[0];
}

function generateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function calculateExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + INVITATION_EXPIRY_DAYS);
  return d.toISOString();
}

async function writeActivity(
  type: string,
  message: string,
  detail: string,
  entityId: string
): Promise<void> {
  try {
    await addDoc(wsCol("activities"), {
      type,
      message,
      detail,
      entityId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[OPENY] Failed to write activity:", err);
  }
}

async function writeNotification(
  type: string,
  title: string,
  message: string,
  entityId: string
): Promise<void> {
  try {
    await addDoc(wsCol("notifications"), {
      type,
      title,
      message,
      entityId,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[OPENY] Failed to write notification:", err);
  }
}

// ── Context shape ─────────────────────────────────────────────

interface InvitationContextValue {
  invitations: Invitation[];
  sendInvitation: (data: {
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    role: string;
    invitedBy: string;
    invitedByName?: string;
  }) => Promise<{ token: string }>;
  cancelInvitation: (id: string) => Promise<void>;
  getInvitationByToken: (token: string) => Promise<Invitation | null>;
  acceptInvitation: (token: string) => Promise<{ success: boolean; invitation?: Invitation }>;
}

const InvitationContext = createContext<InvitationContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function InvitationProvider({ children }: { children: ReactNode }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    const q = query(wsCol("invitations"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvitations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation)));
      },
      (err) => {
        console.error("[OPENY] Invitations listener error:", err);
      }
    );
    return unsub;
  }, []);

  // Stable ref so cancelInvitation can read current invitations without stale closure
  const invitationsRef = useRef(invitations);
  useEffect(() => { invitationsRef.current = invitations; }, [invitations]);

  const sendInvitation = useCallback(
    async (data: {
      email: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      role: string;
      invitedBy: string;
      invitedByName?: string;
    }) => {
      const token = generateToken();
      const now = new Date().toISOString();
      const exp = calculateExpiresAt();
      const displayName = deriveMemberName({
        name: data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
      });

      // Create invitation document
      const docRef = await addDoc(wsCol("invitations"), {
        email: data.email,
        name: displayName !== data.email.split("@")[0] ? displayName : null,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        role: data.role,
        invitedBy: data.invitedBy,
        invitedByName: data.invitedByName ?? data.invitedBy,
        status: "pending" as InvitationStatus,
        token,
        createdAt: now,
        expiresAt: exp,
        acceptedAt: null,
        cancelledAt: null,
      });

      // Activity log
      await writeActivity(
        "invite_sent",
        "Invitation sent",
        `Invitation sent to ${data.email}`,
        docRef.id
      );

      // In-app notification
      await writeNotification(
        "member_invited",
        "Invitation Sent",
        `Invited ${data.email} as ${data.role}`,
        docRef.id
      );

      // Send email via Firestore mail collection (Firebase Trigger Email extension)
      // NOTE: mail collection stays at root level (required by Firebase extension)
      const appUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/accept-invite?token=${token}`
          : `/accept-invite?token=${token}`;

      const recipientName = displayName;

      await addDoc(collection(db, "mail"), {
        to: data.email,
        message: {
          subject: `You're invited to join OPENY OS`,
          html: buildInviteEmail({
            recipientName,
            role: data.role,
            invitedBy: data.invitedByName ?? data.invitedBy,
            acceptUrl: appUrl,
          }),
          text: buildInviteEmailText({
            recipientName,
            role: data.role,
            invitedBy: data.invitedByName ?? data.invitedBy,
            acceptUrl: appUrl,
          }),
        },
      });

      return { token };
    },
    []
  );

  const cancelInvitation = useCallback(async (id: string) => {
    const inv = invitationsRef.current.find((i) => i.id === id);
    const email = inv?.email ?? "";
    const now = new Date().toISOString();

    await updateDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "invitations", id), {
      status: "cancelled" as InvitationStatus,
      cancelledAt: now,
    });

    // Activity log
    await writeActivity(
      "invite_cancelled",
      "Invitation cancelled",
      email ? `Invitation to ${email} was cancelled` : "Invitation was cancelled",
      id
    );

    // In-app notification
    await writeNotification(
      "invite_cancelled",
      "Invitation Cancelled",
      email ? `Invitation to ${email} was cancelled` : "An invitation was cancelled",
      id
    );
  }, []);

  const getInvitationByToken = useCallback(async (token: string): Promise<Invitation | null> => {
    const q = query(wsCol("invitations"), where("token", "==", token));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as Invitation;
  }, []);

  const acceptInvitation = useCallback(
    async (token: string): Promise<{ success: boolean; invitation?: Invitation }> => {
      const invitation = await getInvitationByToken(token);
      if (!invitation) return { success: false };

      if (invitation.status === "accepted") return { success: false, invitation };
      if (invitation.status === "cancelled") return { success: false, invitation };

      const now = new Date();
      const nowISO = now.toISOString();

      if (new Date(invitation.expiresAt) < now) {
        await updateDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "invitations", invitation.id), {
          status: "expired" as InvitationStatus,
        });
        await writeActivity(
          "invite_expired",
          "Invitation expired",
          `Invitation to ${invitation.email} expired`,
          invitation.id
        );
        await writeNotification(
          "invite_expired",
          "Invitation Expired",
          `Invitation to ${invitation.email} has expired`,
          invitation.id
        );
        return { success: false, invitation: { ...invitation, status: "expired" } };
      }

      // Update invitation status
      await updateDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "invitations", invitation.id), {
        status: "accepted" as InvitationStatus,
        acceptedAt: nowISO,
      });

      // Prevent duplicate team members by checking existing email
      const teamQuery = query(wsCol("team"), where("email", "==", invitation.email));
      const teamSnap = await getDocs(teamQuery);

      if (teamSnap.empty) {
        const memberName = deriveMemberName(invitation);

        const memberRef = await addDoc(wsCol("team"), {
          name: memberName,
          role: invitation.role,
          email: invitation.email,
          status: "active",
          initials: makeInitials(memberName),
          color: pickColor(),
  
          createdAt: nowISO,
          updatedAt: nowISO,
        });

        // Activity logs
        await writeActivity(
          "invite_accepted",
          "Invitation accepted",
          `${memberName} accepted invitation as ${invitation.role}`,
          memberRef.id
        );
        await writeActivity(
          "member_joined",
          "New team member joined",
          `${memberName} — ${invitation.role}`,
          memberRef.id
        );

        // In-app notification
        await writeNotification(
          "invite_accepted",
          "Invitation Accepted",
          `${memberName} joined as ${invitation.role}`,
          memberRef.id
        );
      } else {
        // Team member already exists (duplicate prevention)
        await writeActivity(
          "invite_accepted",
          "Invitation accepted",
          `${invitation.email} (already a member) accepted invitation`,
          invitation.id
        );
      }

      return { success: true, invitation: { ...invitation, status: "accepted", acceptedAt: nowISO } };
    },
    [getInvitationByToken]
  );

  const value = useMemo(
    () => ({ invitations, sendInvitation, cancelInvitation, getInvitationByToken, acceptInvitation }),
    [invitations, sendInvitation, cancelInvitation, getInvitationByToken, acceptInvitation]
  );

  return (
    <InvitationContext.Provider value={value}>
      {children}
    </InvitationContext.Provider>
  );
}

// ── Hooks ──────────────────────────────────────────────────────

export function useInvitations(): InvitationContextValue {
  const ctx = useContext(InvitationContext);
  if (!ctx) throw new Error("useInvitations must be used inside <InvitationProvider>");
  return ctx;
}

// ── Email templates ───────────────────────────────────────────

function buildInviteEmail(p: {
  recipientName: string;
  role: string;
  invitedBy: string;
  acceptUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to OPENY OS</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Inter','SF Pro Display',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#18181f;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;background:linear-gradient(135deg,#111118 0%,#1e1e27 100%);border-bottom:1px solid rgba(255,255,255,0.06);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background:#4f8ef7;border-radius:10px;text-align:center;vertical-align:middle;">
                          <span style="color:#fff;font-size:18px;font-weight:700;line-height:36px;">⚡</span>
                        </td>
                        <td style="padding-left:10px;">
                          <span style="color:#f0f0f5;font-size:16px;font-weight:700;letter-spacing:-0.3px;">OPENY OS</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px;color:#f0f0f5;font-size:22px;font-weight:700;letter-spacing:-0.5px;">You're invited!</h1>
              <p style="margin:0 0 24px;color:#8888a0;font-size:15px;line-height:1.6;">
                <strong style="color:#f0f0f5;">${p.invitedBy}</strong> has invited you to join <strong style="color:#f0f0f5;">OPENY OS</strong> as a <strong style="color:#4f8ef7;">${p.role}</strong>.
              </p>

              <p style="margin:0 0 8px;color:#8888a0;font-size:14px;">Hi ${p.recipientName},</p>
              <p style="margin:0 0 28px;color:#8888a0;font-size:14px;line-height:1.7;">
                You've been invited to collaborate on OPENY OS — a premium operations management platform. Click the button below to accept your invitation and get started.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${p.acceptUrl}"
                       style="display:inline-block;background:#4f8ef7;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;font-weight:600;letter-spacing:-0.2px;">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Details box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(79,142,247,0.08);border:1px solid rgba(79,142,247,0.2);border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="color:#8888a0;font-size:12px;">Role</span>
                          <br/>
                          <span style="color:#f0f0f5;font-size:14px;font-weight:600;">${p.role}</span>
                        </td>
                        <td style="padding:4px 0;">
                          <span style="color:#8888a0;font-size:12px;">Invited by</span>
                          <br/>
                          <span style="color:#f0f0f5;font-size:14px;font-weight:600;">${p.invitedBy}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 4px;color:#55556a;font-size:12px;">This invitation expires in ${INVITATION_EXPIRY_DAYS} days.</p>
              <p style="margin:0;color:#55556a;font-size:12px;">If you can't click the button, copy this link: <a href="${p.acceptUrl}" style="color:#4f8ef7;">${p.acceptUrl}</a></p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:#55556a;font-size:11px;text-align:center;">
                OPENY OS · Premium Operations Management · If you did not expect this invitation, you can ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildInviteEmailText(p: {
  recipientName: string;
  role: string;
  invitedBy: string;
  acceptUrl: string;
}): string {
  return `You've been invited to OPENY OS!

Hi ${p.recipientName},

${p.invitedBy} has invited you to join OPENY OS as a ${p.role}.

Accept your invitation here:
${p.acceptUrl}

This invitation expires in ${INVITATION_EXPIRY_DAYS} days.

---
OPENY OS – Premium Operations Management
If you did not expect this invitation, you can ignore this email.
`;
}
