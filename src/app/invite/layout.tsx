export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="ui-card" style={{ width: 'min(560px, 100%)' }}>{children}</section>
    </main>
  );
}
