// Redirect /change-password → /settings/password
import { redirect } from 'next/navigation';

export default function ChangePasswordPage() {
  redirect('/settings/password');
}
