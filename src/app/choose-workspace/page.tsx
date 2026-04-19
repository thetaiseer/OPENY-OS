import { redirect } from 'next/navigation';

export default function ChooseWorkspacePage() {
  redirect('/?switch=1');
}
