import Link from 'next/link';

export function SimpleScreen({ title, subtitle, ctaHref = '/os/dashboard', ctaLabel = 'Go to dashboard' }: { title: string; subtitle: string; ctaHref?: string; ctaLabel?: string }) {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="ui-card" style={{ width: 'min(640px, 100%)' }}>
        <h1 className="ui-title">{title}</h1>
        <p className="ui-subtitle">{subtitle}</p>
        <div style={{ marginTop: 20 }}>
          <Link href={ctaHref} className="ui-btn ui-btn-primary">{ctaLabel}</Link>
        </div>
      </section>
    </main>
  );
}
