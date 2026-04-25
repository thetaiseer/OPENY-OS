import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
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

const themeBootScript = `(function(){try{var t=localStorage.getItem('theme');var theme=t==='light'?'light':'dark';var root=document.documentElement;root.setAttribute('data-theme',theme);if(theme==='dark'){root.classList.add('dark');}else{root.classList.remove('dark');}}catch(e){var root=document.documentElement;root.setAttribute('data-theme','dark');root.classList.add('dark');}})();`;

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${inter.className} font-sans antialiased`}>
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
