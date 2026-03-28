import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { AppProvider } from "@/lib/AppContext";
import { ContentProvider } from "@/lib/ContentContext";
import { LanguageProvider } from "@/lib/LanguageContext";
import { NotificationProvider } from "@/lib/NotificationContext";
import { InvitationProvider } from "@/lib/InvitationContext";
import { CampaignProvider } from "@/lib/CampaignContext";
import { ApprovalProvider } from "@/lib/ApprovalContext";
import { AssetsProvider } from "@/lib/AssetsContext";
import { ClientNotesProvider } from "@/lib/ClientNotesContext";
import { BankProvider } from "@/lib/BankContext";

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
              <ContentProvider>
                <CampaignProvider>
                  <ApprovalProvider>
                    <NotificationProvider>
                      <InvitationProvider>
                        <AssetsProvider>
                          <ClientNotesProvider>
                            <BankProvider>
                              <AppShell>{children}</AppShell>
                            </BankProvider>
                          </ClientNotesProvider>
                        </AssetsProvider>
                      </InvitationProvider>
                    </NotificationProvider>
                  </ApprovalProvider>
                </CampaignProvider>
              </ContentProvider>
            </AppProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
