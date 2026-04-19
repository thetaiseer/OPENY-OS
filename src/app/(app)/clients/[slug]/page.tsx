// Redirect /clients/[slug] → /clients/[slug]/overview
import { redirect } from 'next/navigation';

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/clients/${slug}/overview`);
}
