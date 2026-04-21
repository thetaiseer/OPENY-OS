import { redirect } from 'next/navigation';

export default function DocsRootPage() {
  redirect('/docs/dashboard');
  redirect('/docs/invoice');
}
