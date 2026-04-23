export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-4">
      <div className="h-8 w-32 rounded-xl" style={{ background: 'var(--surface)' }} />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-28 rounded-2xl" style={{ background: 'var(--surface)' }} />
      ))}
    </div>
  );
}
