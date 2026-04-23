// Canonical context exports — use these paths in all new code.
// Existing imports from @/lib/*-context continue to work unchanged.

export { AuthProvider, useAuth } from '@/lib/auth-context';
export { ThemeProvider, useTheme } from '@/lib/theme-context';
export { LangProvider, useLang } from '@/lib/lang-context';
export { ToastProvider, useToast } from '@/lib/toast-context';
export { UploadProvider, useUpload } from '@/lib/upload-context';
export { AiProvider, useAi } from '@/lib/ai-context';
export { CommandPaletteProvider, useCommandPalette } from '@/lib/command-palette-context';
export { QuickActionsProvider, useQuickActions } from '@/lib/quick-actions-context';
