import Link from "next/link";
import { Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'var(--surface-2)' }}>
          
          <AlertCircle size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>404</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>This page doesn&apos;t exist in the system.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
          style={{ background: 'var(--accent)' }}>
          
          <Home size={15} />
          Back to Dashboard
        </Link>
      </div>
    </div>);

}