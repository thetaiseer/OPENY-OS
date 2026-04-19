export function AuthForm({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <h1 className="ui-title">{title}</h1>
      <p className="ui-subtitle">{subtitle}</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
        <input className="ui-input" placeholder="Email" />
        <input className="ui-input" placeholder="Password" type="password" />
        <button className="ui-btn ui-btn-primary">Continue</button>
      </div>
    </>
  );
}
