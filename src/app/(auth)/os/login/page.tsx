import { redirect } from 'next/navigation';

export default async function OsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const url = new URLSearchParams({ workspace: 'os' });
  if (params.next) url.set('next', params.next);
  redirect(`/?${url.toString()}`);
}
