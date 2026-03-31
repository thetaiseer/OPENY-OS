"use client";

// ============================================================
// OPENY OS – Accept Invitation Page (/accept-invite?token=...)
// ============================================================
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Loader2 } from
"lucide-react";
import { useInvitations } from "@/lib/InvitationContext";


// ── State types ───────────────────────────────────────────────











// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// ── Inner component (uses useSearchParams) ────────────────────

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { getInvitationByToken, acceptInvitation } = useInvitations();
  const [state, setState] = useState({ phase: "loading" });

  useEffect(() => {
    (async () => {
      if (!token) {
        setState({ phase: "invalid" });
        return;
      }
      try {
        const inv = await getInvitationByToken(token);
        if (!inv) {
          setState({ phase: "invalid" });
          return;
        }
        if (inv.status === "accepted") {
          setState({ phase: "already_accepted", invitation: inv });
          return;
        }
        if (inv.status === "cancelled") {
          setState({ phase: "cancelled", invitation: inv });
          return;
        }
        if (inv.status === "expired" || new Date(inv.expiresAt) < new Date()) {
          setState({ phase: "expired", invitation: inv });
          return;
        }
        setState({ phase: "ready", invitation: inv });
      } catch (err) {
        console.error("[OPENY] Accept-invite page error:", err);
        setState({ phase: "invalid" });
      }
    })();
  }, [token, getInvitationByToken]);

  const handleAccept = async () => {
    if (state.phase !== "ready") return;
    const inv = state.invitation;
    setState({ phase: "accepting" });
    try {
      const result = await acceptInvitation(token);
      if (result.success && result.invitation) {
        setState({ phase: "success", invitation: result.invitation });
      } else {
        setState({ phase: "expired", invitation: result.invitation ?? inv });
      }
    } catch (err) {
      console.error("[OPENY] Accept error:", err);
      setState({ phase: "invalid" });
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--surface-0)" }}>
      
      <div
        className="w-full max-w-[440px] rounded-3xl overflow-hidden"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.4)"
        }}>
        
        {/* Header */}
        <div
          className="px-8 py-6 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, var(--surface-1) 0%, var(--surface-3) 100%)",
            borderBottom: "1px solid var(--border)"
          }}>
          
          <img
            src="/assets/openy-logo.png"
            alt="OPENY OS"
            height={36}
            style={{ height: 36, width: "auto", objectFit: "contain" }} />
          
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Team Invitation
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-7">
          {/* Loading */}
          {state.phase === "loading" &&
          <div className="flex flex-col items-center py-6 gap-4">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Validating your invitation…
              </p>
            </div>
          }

          {/* Accepting */}
          {state.phase === "accepting" &&
          <div className="flex flex-col items-center py-6 gap-4">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Accepting invitation…
              </p>
            </div>
          }

          {/* Invalid */}
          {state.phase === "invalid" &&
          <div className="flex flex-col items-center gap-4 py-6">
              <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(248,113,113,0.12)" }}>
              
                <XCircle size={28} style={{ color: "#f87171" }} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Invalid Invitation
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  This invitation link is not valid or has been removed.
                </p>
              </div>
            </div>
          }

          {/* Expired */}
          {state.phase === "expired" &&
          <div className="flex flex-col items-center gap-4 py-6">
              <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(251,191,36,0.12)" }}>
              
                <Clock size={28} style={{ color: "#fbbf24" }} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Invitation Expired
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  This invitation has expired. Please ask the admin to send a new one.
                </p>
              </div>
            </div>
          }

          {/* Cancelled */}
          {state.phase === "cancelled" &&
          <div className="flex flex-col items-center gap-4 py-6">
              <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(248,113,113,0.12)" }}>
              
                <AlertCircle size={28} style={{ color: "#f87171" }} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Invitation Cancelled
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  This invitation has been cancelled by the admin.
                </p>
              </div>
            </div>
          }

          {/* Already accepted */}
          {state.phase === "already_accepted" &&
          <div className="flex flex-col items-center gap-4 py-6">
              <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(52,211,153,0.12)" }}>
              
                <CheckCircle size={28} style={{ color: "#34d399" }} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Already Accepted
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  This invitation was already accepted. You are already a team member.
                </p>
              </div>
              <Link
              href="/"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
              style={{ background: "var(--accent)", color: "#fff" }}>
              
                Go to Dashboard
                <ArrowRight size={15} />
              </Link>
            </div>
          }

          {/* Ready */}
          {state.phase === "ready" &&
          <div className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  You&apos;re Invited!
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  <strong style={{ color: "var(--text-secondary)" }}>{state.invitation.invitedByName ?? state.invitation.invitedBy}</strong>{" "}
                  has invited you to join{" "}
                  <strong style={{ color: "var(--text-secondary)" }}>OPENY OS</strong>
                </p>
              </div>

              {/* Details */}
              <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: "rgba(79,142,247,0.07)",
                border: "1px solid rgba(79,142,247,0.18)"
              }}>
              
                <DetailRow label="Email" value={state.invitation.email} />
                <DetailRow label="Role" value={state.invitation.role} accent />
                <DetailRow
                label="Invited by"
                value={state.invitation.invitedByName ?? state.invitation.invitedBy} />
              
                <DetailRow label="Expires" value={formatDate(state.invitation.expiresAt)} />
              </div>

              <button
              onClick={handleAccept}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: "var(--accent)", color: "#fff" }}>
              
                Accept Invitation
                <ArrowRight size={16} />
              </button>
            </div>
          }

          {/* Success */}
          {state.phase === "success" &&
          <div className="flex flex-col items-center gap-5 py-2">
              <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(52,211,153,0.12)" }}>
              
                <CheckCircle size={32} style={{ color: "#34d399" }} />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                  Welcome aboard!
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  You&apos;ve successfully joined OPENY OS as{" "}
                  <strong style={{ color: "var(--accent)" }}>{state.invitation.role}</strong>.
                </p>
              </div>
              <Link
              href="/"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all"
              style={{ background: "var(--accent)", color: "#fff" }}>
              
                Go to Dashboard
                <ArrowRight size={15} />
              </Link>
            </div>
          }
        </div>
      </div>
    </div>);

}

// ── Detail row helper ─────────────────────────────────────────

function DetailRow({
  label,
  value,
  accent




}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span
        className="text-xs font-semibold"
        style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}>
        
        {value}
      </span>
    </div>);

}

// ── Loading fallback ──────────────────────────────────────────

function LoadingFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--surface-0)" }}>
      
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--accent)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Loading…
        </p>
      </div>
    </div>);

}

// ── Page export (wraps in Suspense for useSearchParams) ───────

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AcceptInviteContent />
    </Suspense>);

}