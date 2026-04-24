import type { Metadata, Viewport } from 'next';
// Self-hosted via @fontsource/cairo — no network fetch at build time.
import '@fontsource/cairo/arabic-300.css';
import '@fontsource/cairo/arabic-400.css';
import '@fontsource/cairo/arabic-500.css';
import '@fontsource/cairo/arabic-600.css';
import '@fontsource/cairo/arabic-700.css';
import '@fontsource/cairo/latin-300.css';
import '@fontsource/cairo/latin-400.css';
import '@fontsource/cairo/latin-500.css';
import '@fontsource/cairo/latin-600.css';
import '@fontsource/cairo/latin-700.css';
import './globals.css';
import { ThemeProvider } from '@/context/theme-context';
import { LangProvider } from '@/context/lang-context';
import { AuthProvider } from '@/context/auth-context';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'OPENY',
  description:
    'One unified SaaS platform — OPENY OS for operations and OPENY DOCS for business documents.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OPENY',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#6366f1',
};

const themeBootScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>
          <LangProvider>
            <AuthProvider>
              <Providers>{children}</Providers>
            </AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
