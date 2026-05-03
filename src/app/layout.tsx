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
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: 'var(--text-secondary)',
};

const themeBootScript = `(function(){try{var stored=localStorage.getItem('theme');var theme=stored==='light'||stored==='dark'?stored:'dark';if(!stored){localStorage.setItem('theme',theme);}var root=document.documentElement;root.setAttribute('data-theme',theme);root.classList.toggle('dark',theme==='dark');}catch(e){var root=document.documentElement;root.setAttribute('data-theme','dark');root.classList.add('dark');}})();`;

const assetBreadcrumbOrderScript = `(function(){function reorder(){try{if(!location.pathname.startsWith('/assets'))return;document.querySelectorAll('nav').forEach(function(nav){if(nav.dataset.openyAssetOrderApplied==='1')return;var items=Array.prototype.slice.call(nav.children);if(items.length<6)return;var text=nav.textContent||'';if(!/20\\d{2}/.test(text))return;var sub=items[5];var year=items[3];if(!sub||!year)return;nav.insertBefore(sub,year);nav.dataset.openyAssetOrderApplied='1';});}catch(e){}}reorder();new MutationObserver(function(){document.querySelectorAll('nav[data-openy-asset-order-applied="1"]').forEach(function(nav){nav.dataset.openyAssetOrderApplied='0';});reorder();}).observe(document.documentElement,{childList:true,subtree:true});})();`;

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script id="openy-theme-init" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script
          id="openy-assets-breadcrumb-order"
          dangerouslySetInnerHTML={{ __html: assetBreadcrumbOrderScript }}
        />
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
