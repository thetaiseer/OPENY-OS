import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { AppProvider } from "@/lib/AppContext";
import { LanguageProvider } from "@/lib/LanguageContext";

export const metadata: Metadata = {
  title: "OPENY OS",
  description: "Premium Operations Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <AppProvider>
              <AppShell>{children}</AppShell>
            </AppProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
