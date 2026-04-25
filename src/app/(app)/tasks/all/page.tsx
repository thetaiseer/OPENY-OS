'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/Card';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';

function TasksAllSkeleton() {
  return (
    <PageShell className="animate-pulse">
      <PageHeader title="All tasks" subtitle="Loading workspace tasks..." />
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="h-9 w-40 rounded-card bg-surface" />
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-control bg-surface" />
            <div className="h-9 w-28 rounded-control bg-surface" />
          </div>
        </div>
        <Card>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-card bg-surface" />
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-3 overflow-hidden pb-2">
          {[0, 1, 2, 3].map((col) => (
            <div key={col} className="min-h-[28rem] min-w-[17rem] flex-1 rounded-card bg-surface" />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

const TasksAllView = dynamic(() => import('./TasksAllView'), {
  loading: () => <TasksAllSkeleton />,
  ssr: false,
});

export default function TasksAllPage() {
  return <TasksAllView />;
}
