import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="ui-card" style={{ width: 'min(760px, 100%)' }}>
        <p style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.12em' }}>New Product Launch</p>
        <h1 className="ui-title">OPENY OS Reconstructed</h1>
        <p className="ui-subtitle">The legacy visual layer was removed. This is the rebuilt UI system.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          <Link href="/os/dashboard" className="ui-btn ui-btn-primary">Enter Workspace</Link>
          <Link href="/docs" className="ui-btn">Open Docs</Link>
          <Link href="/login" className="ui-btn">Auth</Link>
        </div>
      </div>
    </main>
  );
}
