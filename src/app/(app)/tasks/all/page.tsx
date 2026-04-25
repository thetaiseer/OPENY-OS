'use client';

import dynamic from 'next/dynamic';

function TasksAllSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="h-9 w-40 rounded-xl" style={{ background: 'var(--surface)' }} />
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg" style={{ background: 'var(--surface)' }} />
          <div className="h-9 w-28 rounded-lg" style={{ background: 'var(--surface)' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden pb-2">
        {[0, 1, 2, 3].map((col) => (
          <div
            key={col}
            className="min-h-[28rem] min-w-[17rem] flex-1 rounded-2xl"
            style={{ background: 'var(--surface)' }}
          />
        ))}
      </div>
    </div>
  );
}

const TasksAllView = dynamic(() => import('./TasksAllView'), {
  loading: () => <TasksAllSkeleton />,
  ssr: false,
});

export default function TasksAllPage() {
  return <TasksAllView />;
}
