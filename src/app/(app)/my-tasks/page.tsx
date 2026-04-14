// Redirect /my-tasks → /tasks/my
import { redirect } from 'next/navigation';

export default function MyTasksPage() {
  redirect('/tasks/my');
}
