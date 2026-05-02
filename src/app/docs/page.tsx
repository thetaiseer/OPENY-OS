export default function DocsPage() {
  return (
    <iframe
      src="/docs-app/index.html"
      className="w-full rounded-xl border-0"
      style={{ height: 'calc(100dvh - 10rem)', minHeight: '600px' }}
      title="Docs"
      allow="clipboard-write"
    />
  );
}
