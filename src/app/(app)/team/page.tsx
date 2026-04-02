'use client';

import { Users } from 'lucide-react';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';

export default function TeamPage() {
  const { t } = useLang();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('team')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Your team members</p>
      </div>
      <EmptyState icon={Users} title="No team members" description="Invite your team to collaborate" />
    </div>
  );
}
