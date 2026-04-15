import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme-context';
import { LangProvider } from '@/lib/lang-context';
import { AuthProvider } from '@/lib/auth-context';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'OPENY OS',
  description: 'Modern SaaS workspace for social media agencies',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OPENY OS',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#6366f1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LangProvider>
            <AuthProvider>
              <Providers>
                {children}
              </Providers>
            </AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
