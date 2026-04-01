"use client";

import { useEffect } from "react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 240;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isRTL } = useLanguage();
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isLoginPage = pathname === "/login";

  // Redirect unauthenticated users to login (except the login page itself)
  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.replace("/login");
    }
  }, [loading, user, isLoginPage, router]);

  // Show login page without shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show a spinner while auth state is resolving
  if (loading || !user) {
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

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <SideNav collapsed={collapsed} onToggleCollapse={() => setCollapsed(v => !v)} />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(5,8,16,0.7)",
              backdropFilter: "blur(4px)",
            }}
          >
            <motion.div
              initial={{ x: isRTL ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? "100%" : "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
              onClick={e => e.stopPropagation()}
              style={{
                position: "absolute",
                top: 0,
                left: isRTL ? "auto" : 0,
                right: isRTL ? 0 : "auto",
                height: "100%",
                width: EXPANDED_WIDTH,
              }}
            >
              <SideNav collapsed={false} onToggleCollapse={() => setMobileOpen(false)} />
              <button
                onClick={() => setMobileOpen(false)}
                style={{
                  position: "absolute", top: 12,
                  right: isRTL ? "auto" : 8,
                  left: isRTL ? 8 : "auto",
                  width: 28, height: 28, borderRadius: 6,
                  background: "var(--glass-overlay)",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", zIndex: 10,
                }}
              >
                <X size={14} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar — offsets from sidebar on desktop */}
      <div className="hidden md:block">
        <TopBar sidebarWidth={sidebarWidth} onMobileMenuOpen={() => setMobileOpen(true)} />
      </div>
      <div className="md:hidden">
        <TopBar sidebarWidth={0} onMobileMenuOpen={() => setMobileOpen(true)} />
      </div>

      {/* Main content area */}
      <div
        style={{
          paddingTop: "var(--topbar-height)",
          paddingBottom: "var(--bottomnav-height, 64px)",
        }}
        className="md:pl-0 md:pr-0"
      >
        {/* Desktop offset via inline style */}
        <div
          style={{
            paddingLeft: isRTL ? 0 : undefined,
            paddingRight: isRTL ? undefined : 0,
          }}
          className="hidden md:block"
        >
          <div
            style={{
              marginLeft: isRTL ? 0 : sidebarWidth,
              marginRight: isRTL ? sidebarWidth : 0,
              transition: "margin 0.25s ease",
            }}
          >
            <main style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>

        {/* Mobile content */}
        <div className="md:hidden">
          <main style={{ padding: "16px" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
