// Canonical context exports — use these paths in all new code.
// Existing imports from @/lib/*-context continue to work unchanged.

export { AuthProvider, useAuth } from '@/context/auth-context';
export { ThemeProvider, useTheme } from '@/context/theme-context';
export { LangProvider, useLang } from '@/context/lang-context';
export { ToastProvider, useToast } from '@/context/toast-context';
export { UploadProvider, useUpload } from '@/context/upload-context';
export { AiProvider, useAi } from '@/context/ai-context';
export { CommandPaletteProvider, useCommandPalette } from '@/context/command-palette-context';
export { QuickActionsProvider, useQuickActions } from '@/context/quick-actions-context';
export {
  AppPeriodProvider,
  useAppPeriod,
  calendarMonthNow,
  monthDayBounds,
} from '@/context/app-period-context';
