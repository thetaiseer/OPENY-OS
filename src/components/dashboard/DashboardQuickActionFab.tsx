'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  CheckSquare,
  FolderKanban,
  Users,
  ImageIcon,
  FileText,
  CalendarClock,
  FileSpreadsheet,
  ScrollText,
  FileSignature,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useQuickActions, type QuickActionId } from '@/context/quick-actions-context';
import { useLang } from '@/context/lang-context';

type MenuEntry =
  | { type: 'action'; id: QuickActionId; label: string; icon: LucideIcon }
  | { type: 'link'; href: string; label: string; icon: LucideIcon };

type Section = { title: string; items: MenuEntry[] };

export default function DashboardQuickActionFab() {
  const { t } = useLang();
  const router = useRouter();
  const { triggerQuickAction } = useQuickActions();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  const sections: Section[] = [
    {
      title: t('quickActionSectionCore'),
      items: [
        { type: 'action', id: 'add-task', label: t('newTask'), icon: CheckSquare },
        { type: 'action', id: 'add-project', label: t('newProject'), icon: FolderKanban },
        { type: 'action', id: 'add-client', label: t('newClient'), icon: Users },
        { type: 'action', id: 'add-asset', label: t('uploadAsset'), icon: ImageIcon },
      ],
    },
    {
      title: t('quickActionSectionContent'),
      items: [
        { type: 'action', id: 'add-content', label: t('newContent'), icon: FileText },
        {
          type: 'link',
          href: '/calendar',
          label: t('quickActionSchedulePost'),
          icon: CalendarClock,
        },
      ],
    },
    {
      title: t('quickActionSectionDocs'),
      items: [
        {
          type: 'link',
          href: '/docs/invoice',
          label: t('quickActionCreateDoc', { label: t('docModuleInvoice') }),
          icon: FileSpreadsheet,
        },
        {
          type: 'link',
          href: '/docs/quotation',
          label: t('quickActionCreateDoc', { label: t('docModuleQuotation') }),
          icon: ScrollText,
        },
        {
          type: 'link',
          href: '/docs/client-contract',
          label: t('quickActionCreateDoc', { label: t('docModuleClientContract') }),
          icon: FileSignature,
        },
      ],
    },
    {
      title: t('quickActionSectionTeam'),
      items: [
        {
          type: 'link',
          href: '/team?invite=1',
          label: t('teamInviteMember'),
          icon: UserPlus,
        },
      ],
    },
  ];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const first = rootRef.current?.querySelector<HTMLElement>('[data-quick-action-item]');
    first?.focus();
  }, [open]);

  const runEntry = (entry: MenuEntry) => {
    setOpen(false);
    if (entry.type === 'action') {
      triggerQuickAction(entry.id);
      return;
    }
    router.push(entry.href);
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        'pointer-events-none fixed z-50 flex flex-col items-end gap-2',
        'bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]',
        'end-4',
        'md:bottom-6',
        'md:end-6',
      )}
    >
      {/* Menu panel — always rendered, animated via inline style */}
      <div
        id={menuId}
        role="menu"
        aria-label={t('quickActions') ?? 'Quick actions'}
        className="pointer-events-auto mb-1 max-h-[min(70vh,28rem)] w-[min(calc(100vw-2rem),17rem)] overflow-y-auto overscroll-contain rounded-2xl border p-2"
        style={{
          background: 'color-mix(in srgb, var(--surface) 94%, white 6%)',
          borderColor: 'var(--border)',
          boxShadow: '0 16px 40px rgba(15,23,42,0.16)',
          backdropFilter: 'blur(10px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? undefined : 'none',
          transform: open ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
          transformOrigin: 'bottom right',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        {sections.map((section) => (
          <div key={section.title} role="presentation" className="mb-2 last:mb-0">
            <p
              className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {section.title}
            </p>
            <div className="flex flex-col gap-0.5" role="group" aria-label={section.title}>
              {section.items.map((entry, idx) => {
                const Icon = entry.icon;
                const key =
                  entry.type === 'action'
                    ? `${section.title}-${entry.id}-${idx}`
                    : `${section.title}-${entry.href}-${idx}`;
                return (
                  <button
                    key={key}
                    type="button"
                    role="menuitem"
                    data-quick-action-item
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-start text-sm transition-colors hover:bg-[color:var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    style={{ color: 'var(--text)' }}
                    onClick={() => runEntry(entry)}
                  >
                    <Icon size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
                    <span className="min-w-0 leading-snug">{entry.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        ref={triggerRef}
        type="button"
        className="pointer-events-auto inline-flex h-14 min-h-14 w-14 min-w-14 shrink-0 items-center justify-center rounded-full shadow-soft-md transition-[filter,box-shadow] hover:brightness-105 active:brightness-95"
        style={{
          background: 'var(--accent)',
          color: 'var(--primary-foreground)',
          boxShadow: open
            ? '0 8px 24px color-mix(in srgb, var(--accent) 50%, transparent)'
            : '0 4px 16px color-mix(in srgb, var(--accent) 35%, transparent)',
        }}
        aria-label={t('quickActions') ?? 'Quick actions'}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus
          className={cn('h-6 w-6 transition-transform duration-300', open && 'rotate-45')}
          aria-hidden
        />
      </button>
    </div>
  );
}
