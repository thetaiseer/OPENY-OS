"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  /** When true, backdrop click and Escape key are disabled to prevent
   *  accidental dismissal while an async operation is in progress. */
  loading?: boolean;
}

export function Modal({ open, onClose, title, children, maxWidth = "min(92vw, 560px)", loading = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
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

  const content = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={!loading ? onClose : undefined}
        >
          <motion.div
            className="glass-modal flex flex-col overflow-hidden"
            style={{
              width: "100%",
              maxWidth,
              maxHeight: "min(88vh, 820px)",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 440, damping: 34 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
              <motion.button
                onClick={!loading ? onClose : undefined}
                disabled={loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                style={{ background: 'var(--glass-overlay)', border: '1px solid var(--glass-overlay-border)', color: 'var(--text-secondary)' }}
                whileHover={!loading ? { scale: 1.1 } : undefined}
                whileTap={!loading ? { scale: 0.95 } : undefined}
              >
                <X size={14} />
              </motion.button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
