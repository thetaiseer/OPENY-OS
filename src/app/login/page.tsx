"use client";

// ============================================================
// OPENY OS – Login Page
// Email/password sign-in. thetaiseer@gmail.com auto-receives
// admin role on first login (bootstrapped in AuthContext).
// ============================================================

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");

  // If already signed in, go to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace("/clients");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(isAr ? "يرجى إدخال البريد الإلكتروني وكلمة المرور" : "Please enter your email and password");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      router.replace("/clients");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setError(isAr ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email or password");
      } else if (code === "auth/too-many-requests") {
        setError(isAr ? "تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقًا" : "Too many attempts. Please try again later");
      } else {
        setError(isAr ? "حدث خطأ. حاول مرة أخرى" : "An error occurred. Please try again");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "var(--bg)",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          border: "3px solid var(--border)",
          borderTopColor: "var(--accent)",
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--bg)", padding: "24px",
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{ width: "100%", maxWidth: 440 }}
      >
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(59,130,246,0.3)",
          }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 22, letterSpacing: "-1px" }}>O</span>
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 800, color: "var(--text)",
            margin: 0, letterSpacing: "-0.5px",
          }}>
            OPENY OS
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 6 }}>
            {isAr ? "نظام إدارة العمليات" : "Operations Management System"}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 24,
          padding: "32px 28px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
        }}>
          <h2 style={{
            fontSize: 18, fontWeight: 700, color: "var(--text)",
            margin: "0 0 6px", textAlign: isAr ? "right" : "left",
          }}>
            {isAr ? "تسجيل الدخول" : "Sign in"}
          </h2>
          <p style={{
            fontSize: 13, color: "var(--text-muted)", margin: "0 0 28px",
            textAlign: isAr ? "right" : "left",
          }}>
            {isAr ? "أدخل بيانات حسابك للمتابعة" : "Enter your credentials to continue"}
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Email */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
                textAlign: isAr ? "right" : "left",
              }}>
                {isAr ? "البريد الإلكتروني" : "Email"}
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={15}
                  style={{
                    position: "absolute",
                    top: "50%", transform: "translateY(-50%)",
                    left: isAr ? "auto" : 14,
                    right: isAr ? 14 : "auto",
                    color: "var(--text-muted)", pointerEvents: "none",
                  }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@company.com"
                  required
                  dir="ltr"
                  className="glass-input"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    paddingLeft: isAr ? 14 : 42,
                    paddingRight: isAr ? 42 : 14,
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{
                fontSize: 12, fontWeight: 600, color: "var(--text-muted)",
                textAlign: isAr ? "right" : "left",
              }}>
                {isAr ? "كلمة المرور" : "Password"}
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={15}
                  style={{
                    position: "absolute",
                    top: "50%", transform: "translateY(-50%)",
                    left: isAr ? "auto" : 14,
                    right: isAr ? 14 : "auto",
                    color: "var(--text-muted)", pointerEvents: "none",
                  }}
                />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isAr ? "كلمة المرور" : "Password"}
                  required
                  dir="ltr"
                  className="glass-input"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    paddingLeft: isAr ? 42 : 42,
                    paddingRight: isAr ? 42 : 42,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: "absolute", top: "50%", transform: "translateY(-50%)",
                    right: isAr ? "auto" : 14,
                    left: isAr ? 14 : "auto",
                    background: "none", border: "none",
                    color: "var(--text-muted)", cursor: "pointer", padding: 2,
                    display: "flex", alignItems: "center",
                  }}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.25)",
                borderRadius: 12, padding: "10px 14px",
                fontSize: 13, color: "#f87171",
                textAlign: isAr ? "right" : "left",
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 8, width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: 14, padding: "13px 24px",
                fontSize: 15, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              <LogIn size={17} />
              {submitting
                ? (isAr ? "جارٍ الدخول…" : "Signing in…")
                : (isAr ? "دخول" : "Sign in")}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: "center", marginTop: 24,
          fontSize: 12, color: "var(--text-muted)",
        }}>
          OPENY OS © {new Date().getFullYear()}
        </p>
      </motion.div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
