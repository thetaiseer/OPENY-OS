"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  tone?: "default" | "danger" | "warning";
  onClick: () => void;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  size?: number;
}

export function ActionMenu({ items, size = 18 }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--glass-overlay)] hover:text-[var(--text)]"
        aria-label="Actions"
      >
        <MoreHorizontal size={size} />
      </button>

      {open && (
        <div
          className="absolute end-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-[18px] border border-[var(--border)] py-1 shadow-2xl"
          style={{ background: "var(--panel-strong)" }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isDanger = item.tone === "danger";
            return (
              <button
                key={item.label}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition hover:bg-[var(--glass-overlay)]"
                style={{ color: isDanger ? "var(--rose)" : "var(--text)" }}
              >
                {Icon && <Icon size={15} style={{ opacity: 0.8 }} />}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
