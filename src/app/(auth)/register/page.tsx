'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLang } from '@/lib/lang-context';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLang();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-full max-w-sm rounded-2xl p-8 border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text)' }}>
          {t('registerTitle')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          OPENY OS — Your modern workspace
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200">
            {error}
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('name')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('email')}</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t('password')}</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--accent)' }}
        >
          {loading ? t('loading') : t('signUp')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
