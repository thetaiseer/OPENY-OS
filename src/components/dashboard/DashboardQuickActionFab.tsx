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
        'pointer-events-none fixed z-50 flex flex-col items-end gap-3',
        'bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] end-4',
        'md:bottom-6 md:end-6',
      )}
    >
      {/* Menu panel — toggled via opacity/transform for smooth animation */}
      <div
        id={menuId}
        role="menu"
        aria-label={t('quickActions') ?? 'Quick actions'}
        className={cn(
          'mb-1 max-h-[min(70vh,28rem)] w-[min(calc(100vw-2rem),17rem)]',
          'overflow-y-auto overscroll-contain rounded-2xl border p-2',
          'origin-bottom-right transition-all duration-200 ease-out',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-2 scale-95 opacity-0',
        )}
        style={{
          background: 'color-mix(in srgb, var(--surface) 96%, white 4%)',
          borderColor: 'var(--border)',
          boxShadow: '0 20px 48px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {sections.map((section) => (
          <div key={section.title} role="presentation" className="mb-2 last:mb-0">
            <p
              className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider"
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
                    className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-start text-sm transition-colors hover:bg-[color:var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    style={{ color: 'var(--text)' }}
                    onClick={() => runEntry(entry)}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                    >
                      <Icon size={14} aria-hidden />
                    </span>
                    <span className="min-w-0 leading-snug">{entry.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* FAB trigger */}
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'pointer-events-auto inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full',
          'transition-all duration-200 ease-out hover:scale-110 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]/40',
        )}
        style={{
          background: 'var(--accent)',
          color: '#fff',
          boxShadow: open
            ? '0 8px 24px color-mix(in srgb, var(--accent) 50%, transparent), 0 2px 8px rgba(0,0,0,0.2)'
            : '0 4px 16px color-mix(in srgb, var(--accent) 35%, transparent), 0 2px 6px rgba(0,0,0,0.15)',
        }}
        aria-label={t('quickActions') ?? 'Quick actions'}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
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
