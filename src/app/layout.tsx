import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme-context';
import { LangProvider } from '@/lib/lang-context';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'OPENY OS',
  description: 'Modern SaaS workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LangProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
