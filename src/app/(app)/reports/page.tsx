// Redirect /reports → /reports/overview
import { redirect } from 'next/navigation';

export default function ReportsPage() {
  redirect('/reports/overview');
}
