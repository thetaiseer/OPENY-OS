import { redirect } from 'next/navigation';

// Approvals have been removed from the system.
// Redirect any direct visits to the overview tab.
export default async function ApprovalsRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/clients/${slug}/overview`);
}
