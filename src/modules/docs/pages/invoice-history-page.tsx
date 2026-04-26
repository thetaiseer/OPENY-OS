'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, Search } from 'lucide-react';
import type { DocsInvoice } from '@/lib/docs-types';
import { useLang } from '@/context/lang-context';

function fmtDate(value?: string | null, locale: 'en' | 'ar' = 'en') {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function InvoiceHistoryPage() {
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState<DocsInvoice[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'paid' | 'unpaid'>('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/docs/invoices', { cache: 'no-store' });
        const json = (await res.json()) as { invoices?: DocsInvoice[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? t('docInvLoadError'));
        if (!cancelled) {
          const sorted = (json.invoices ?? []).sort(
            (a, b) => +new Date(b.updated_at) - +new Date(a.updated_at),
          );
          setInvoices(sorted);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('docInvLoadError'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (status !== 'all' && invoice.status !== status) return false;
      if (!q) return true;
      return (
        invoice.invoice_number.toLowerCase().includes(q) ||
        invoice.client_name.toLowerCase().includes(q) ||
        (invoice.campaign_month ?? '').toLowerCase().includes(q)
      );
    });
  }, [invoices, search, status]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            {t('docInvHistoryPageTitle')}
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('docInvHistoryPageDesc')}
          </p>
        </div>
        <Link
          href="/docs/invoice"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <ArrowLeft size={14} />
          {t('docInvBackToEditor')}
        </Link>
      </div>

      <div
        className="grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_200px]"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <label className="relative block">
          <Search
            size={14}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-secondary)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('docInvHistorySearchPh')}
            className="h-10 w-full rounded-lg border pe-3 ps-9 text-sm outline-none"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
            }}
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | 'paid' | 'unpaid')}
          className="h-10 rounded-lg border px-3 text-sm outline-none"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text)',
          }}
        >
          <option value="all">{t('all')}</option>
          <option value="paid">{t('docStatusPaid')}</option>
          <option value="unpaid">{t('docStatusUnpaid')}</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg"
              style={{ background: 'var(--surface)' }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          className="rounded-xl border px-3 py-2 text-sm text-red-600"
          style={{ borderColor: 'rgba(239,68,68,0.35)' }}
        >
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl border px-4 py-8 text-center"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <FileText className="mx-auto mb-2" size={20} style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>{t('docInvHistoryEmpty')}</p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div
            className="grid grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_0.8fr] gap-2 border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <span>{t('docInvInvoiceNumber')}</span>
            <span>{t('docInvClientField')}</span>
            <span>{t('docInvCampaignMonth')}</span>
            <span>{t('status')}</span>
            <span>{t('actions')}</span>
          </div>
          {filtered.map((invoice) => (
            <div
              key={invoice.id}
              className="grid grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_0.8fr] gap-2 border-b px-3 py-2 text-sm last:border-b-0"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{invoice.invoice_number}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {fmtDate(invoice.updated_at, lang)}
                </p>
              </div>
              <p className="truncate">{invoice.client_name}</p>
              <p>{invoice.campaign_month ?? '—'}</p>
              <p>{invoice.status === 'paid' ? t('docStatusPaid') : t('docStatusUnpaid')}</p>
              <div className="flex items-center gap-1">
                <Link
                  href={`/docs/invoice?invoiceId=${invoice.id}`}
                  className="rounded border px-2 py-1 text-xs font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  {t('open')}
                </Link>
                <a
                  href={`/api/docs/invoices/${invoice.id}/export`}
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  <Download size={11} />
                  {t('docInvExcel')}
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
