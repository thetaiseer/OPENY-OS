import { redirect } from 'next/navigation';

export default async function DocsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const url = new URLSearchParams({ workspace: 'docs' });
  if (params.next) url.set('next', params.next);
  redirect(`/?${url.toString()}`);
}
