'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import pb from '@/lib/pocketbase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';

interface TeamMember { id: string; name: string; email: string; role?: string; }

export default function TeamPage() {
  const { t } = useLang();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await pb.collection('users').getList(1, 50, {});
        setMembers(res.items as unknown as TeamMember[]);
      } catch {
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('team')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Your team members</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title="No team members" description="Invite your team to collaborate" />
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {members.map(member => (
            <div
              key={member.id}
              className="flex items-center gap-4 px-6 py-4 border-b last:border-b-0"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                style={{ background: 'var(--accent)' }}
              >
                {(member.name || member.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{member.name || member.email}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{member.email}</p>
              </div>
              {member.role && <Badge>{member.role}</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
