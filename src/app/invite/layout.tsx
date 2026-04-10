import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "You're Invited – OPENY OS",
  description: 'Accept your invitation to join your team on OPENY OS.',
  robots: { index: false, follow: false },
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
