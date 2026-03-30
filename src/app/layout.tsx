import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { AppProvider } from "@/lib/AppContext";
import { ContentProvider } from "@/lib/ContentContext";
import { LanguageProvider } from "@/lib/LanguageContext";
import { NotificationProvider } from "@/lib/NotificationContext";
import { InvitationProvider } from "@/lib/InvitationContext";
import { ApprovalProvider } from "@/lib/ApprovalContext";
import { AssetsProvider } from "@/lib/AssetsContext";
import { ClientNotesProvider } from "@/lib/ClientNotesContext";
import { BankProvider } from "@/lib/BankContext";
import { PublishingProvider } from "@/lib/PublishingContext";
import { ToastProvider } from "@/lib/ToastContext";
import { ToastContainer } from "@/components/ui/ToastContainer";

export const metadata: Metadata = {
  title: "OPENY OS",
  description: "Premium Operations Management System",
  icons: {
    icon: "/assets/openy-logo.png",
    apple: "/assets/openy-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <AppProvider>
                <ContentProvider>
                  <ApprovalProvider>
                    <NotificationProvider>
                      <InvitationProvider>
                        <AssetsProvider>
                          <ClientNotesProvider>
                            <BankProvider>
                              <PublishingProvider>
                                <AppShell>{children}</AppShell>
                              </PublishingProvider>
                            </BankProvider>
                          </ClientNotesProvider>
                        </AssetsProvider>
                      </InvitationProvider>
                    </NotificationProvider>
                  </ApprovalProvider>
                </ContentProvider>
              </AppProvider>
              <ToastContainer />
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
