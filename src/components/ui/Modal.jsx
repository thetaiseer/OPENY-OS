"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";












export function Modal({ open, onClose, title, children, maxWidth = "min(92vw, 560px)", loading = false }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      // Block Escape while a destructive/async action is in progress
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, loading, onClose]);

  const content =
  <AnimatePresence>
      {open &&
    <motion.div
      className="modal-backdrop"
      style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={!loading ? onClose : undefined}>
      
          <motion.div
        className="glass-modal flex flex-col overflow-hidden"
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "min(88vh, 820px)",
          borderRadius: "24px",
          background: "var(--panel)",
          boxShadow: "0 24px 64px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.10)"
        }}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 440, damping: 34 }}
        onClick={(e) => e.stopPropagation()}>
        
            <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>{title}</h2>
              <motion.button
            onClick={!loading ? onClose : undefined}
            disabled={loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--muted)" }}
            whileHover={!loading ? { scale: 1.08, background: "var(--glass-overlay)" } : undefined}
            whileTap={!loading ? { scale: 0.94 } : undefined}>
            
                <X size={14} />
              </motion.button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </motion.div>
    }
    </AnimatePresence>;


  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}