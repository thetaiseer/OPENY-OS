import { Suspense } from 'react';
import OfficialAuthLanding from '@/components/auth/OfficialAuthLanding';

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'var(--bg)' }} />}>
      <OfficialAuthLanding />
    </Suspense>
  );
}
