import { DocsShell } from '@/new-ui/workspace-shell';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
  return (
    <CommandPaletteProvider>
      <AiProvider>
        <DocsLayoutInner>{children}</DocsLayoutInner>
      </AiProvider>
    </CommandPaletteProvider>
  );
}

function DocsLayoutInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isOpen: paletteOpen, close: closePalette } = useCommandPalette();

  useEffect(() => {
    if (!pathname.startsWith('/docs/documents')) return;

    const requestRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => router.refresh(), DOCS_REALTIME_REFRESH_DEBOUNCE_MS);
    };

    const tables = getRealtimeTablesForPath(pathname);

    const unsubscribers = [
      ...tables.map(table => subscribeToTableChanges({ table }, requestRefresh)),
    ];

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      unsubscribers.forEach(unsub => unsub());
    };
  }, [pathname, router]);

  return (
    <>
      <AppShell
        workspaceClassName="docs-workspace"
        sidebar={<DocsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        topbar={<AppTopbar onMenuClick={() => setSidebarOpen(true)} />}
        mainClassName="docs-main"
        containerClassName="docs-shell-container"
      >
        <AppPage fill>{children}</AppPage>
      </AppShell>
      <AiCommandCenter />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </>
  );
}
