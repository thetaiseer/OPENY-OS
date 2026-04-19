// Redirect /tasks → /tasks/all
import { redirect } from 'next/navigation';

export default function TasksPage() {
  redirect('/tasks/all');
}
