'use client';

/**
 * AiContext — global AI Command Center state.
 *
 * Provides:
 *  - isOpen / open() / close() — controls Command Center visibility
 *  - mode — current AI mode: ask | do | suggest | review
 *  - setMode — change mode programmatically
 *  - section — current app section derived from pathname
 *  - clientContext — if user is inside a client workspace
 *  - initialPrompt — optional pre-filled prompt when opening
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiMode = 'ask' | 'do' | 'suggest' | 'review';

export type AppSection =
  | 'dashboard'
  | 'clients'
  | 'tasks'
  | 'content'
  | 'calendar'
  | 'assets'
  | 'reports'
  | 'team'
  | 'settings'
  | 'general';

export interface ClientContext {
  id?: string;
  name?: string;
  slug?: string;
}

export interface OpenOptions {
  mode?: AiMode;
  prompt?: string;
  clientContext?: ClientContext;
}

interface AiContextValue {
  isOpen: boolean;
  mode: AiMode;
  section: AppSection;
  clientContext: ClientContext | null;
  initialPrompt: string;
  open: (opts?: OpenOptions) => void;
  close: () => void;
  setMode: (mode: AiMode) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pathnameToSection(pathname: string): AppSection {
  if (pathname.startsWith('/os/dashboard')) return 'dashboard';
  if (pathname.startsWith('/os/clients'))   return 'clients';
  if (pathname.startsWith('/os/tasks'))     return 'tasks';
  if (pathname.startsWith('/os/content'))   return 'content';
  if (pathname.startsWith('/os/calendar'))  return 'calendar';
  if (pathname.startsWith('/os/assets'))    return 'assets';
  if (pathname.startsWith('/os/reports'))   return 'reports';
  if (pathname.startsWith('/os/team'))      return 'team';
  if (pathname.startsWith('/os/settings'))  return 'settings';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/clients'))   return 'clients';
  if (pathname.startsWith('/tasks'))     return 'tasks';
  if (pathname.startsWith('/content'))   return 'content';
  if (pathname.startsWith('/calendar'))  return 'calendar';
  if (pathname.startsWith('/assets'))    return 'assets';
  if (pathname.startsWith('/reports'))   return 'reports';
  if (pathname.startsWith('/team'))      return 'team';
  if (pathname.startsWith('/settings'))  return 'settings';
  return 'general';
}

// ── Context ───────────────────────────────────────────────────────────────────

const AiCtx = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen]               = useState(false);
  const [mode, setMode]                   = useState<AiMode>('ask');
  const [clientContext, setClientContext] = useState<ClientContext | null>(null);
  const [initialPrompt, setInitialPrompt] = useState('');

  const section = useMemo(() => pathnameToSection(pathname), [pathname]);

  const open = useCallback((opts?: OpenOptions) => {
    if (opts?.mode)          setMode(opts.mode);
    if (opts?.clientContext) setClientContext(opts.clientContext);
    if (opts?.prompt)        setInitialPrompt(opts.prompt);
    else                     setInitialPrompt('');
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setInitialPrompt('');
  }, []);

  const value = useMemo<AiContextValue>(
    () => ({ isOpen, mode, section, clientContext, initialPrompt, open, close, setMode }),
    [isOpen, mode, section, clientContext, initialPrompt, open, close, setMode],
  );

  return <AiCtx.Provider value={value}>{children}</AiCtx.Provider>;
}

export function useAi(): AiContextValue {
  const ctx = useContext(AiCtx);
  if (!ctx) throw new Error('useAi must be used inside <AiProvider>');
  return ctx;
}
