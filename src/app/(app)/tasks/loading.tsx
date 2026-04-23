export default function TasksLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 w-48 rounded-xl" style={{ background: 'var(--surface)' }} />
      <div className="h-10 rounded-xl" style={{ background: 'var(--surface)' }} />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-16 rounded-2xl" style={{ background: 'var(--surface)' }} />
      ))}
    </div>
  );
}
