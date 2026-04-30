'use client';

import type { CSSProperties, ReactNode } from 'react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { INVOICE_ADDRESS, INVOICE_EMAIL, INVOICE_WEBSITE } from '@/lib/docs-invoice-document-model';
import { OPENY_DOC_BLACK, openyMarketingLogoDimensions } from '@/lib/openy-brand';

export function OpenyDocumentPage({
  id,
  children,
  dir,
  fontFamily,
  fontSize = 12,
}: {
  id: string;
  children: ReactNode;
  dir?: 'ltr' | 'rtl';
  fontFamily?: string;
  fontSize?: number;
}) {
  return (
    <div
      id={id}
      className="openy-doc-page w-full bg-white text-[color:var(--text-primary)]"
      dir={dir}
      style={{
        fontFamily: fontFamily ?? 'var(--font-arabic), Inter, system-ui, sans-serif',
        fontSize,
        width: '100%',
        maxWidth: '210mm',
        minHeight: '297mm',
        padding: '12mm',
        boxSizing: 'border-box',
        color: OPENY_DOC_BLACK,
        background: 'var(--accent-foreground)',
        marginInline: 'auto',
        overflow: 'visible',
      }}
    >
      {children}
    </div>
  );
}

export function OpenyDocumentHeader({
  title,
  number,
  date,
  refLabel = 'REF:',
  dateLabel = 'DATE:',
  subtitle,
  centerTitle,
}: {
  title: string;
  number?: string;
  date?: string;
  refLabel?: string;
  dateLabel?: string;
  subtitle?: string;
  centerTitle?: boolean;
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          gap: 24,
          minWidth: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <OpenyLogo
            forceVariant="light"
            {...openyMarketingLogoDimensions(40)}
            alt="OPENY MARKETING AGENCY"
          />
          <div style={{ fontSize: 11, color: '#555', marginTop: 6, lineHeight: 1.5 }}>
            {INVOICE_ADDRESS} | {INVOICE_EMAIL} | {INVOICE_WEBSITE}
            {subtitle ? (
              <>
                <br />
                {subtitle}
              </>
            ) : null}
          </div>
        </div>
        <div
          style={{
            textAlign: centerTitle ? ('center' as const) : ('right' as const),
            minWidth: 0,
            flex: '0 1 auto',
            overflowWrap: 'anywhere',
          }}
        >
          <div
            style={{
              fontSize: 31,
              fontWeight: 900,
              letterSpacing: 2,
              color: OPENY_DOC_BLACK,
              marginBottom: 8,
              lineHeight: 1.05,
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </div>
          {number ? (
            <div style={{ fontSize: 11, color: '#555' }}>
              <span style={{ fontWeight: 700, color: OPENY_DOC_BLACK }}>{refLabel}</span> {number}
            </div>
          ) : null}
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
            <span style={{ fontWeight: 700, color: OPENY_DOC_BLACK }}>{dateLabel}</span>{' '}
            {date || '—'}
          </div>
        </div>
      </div>
      <div style={{ height: 2, background: OPENY_DOC_BLACK, margin: '14px 0 20px 0' }} />
    </>
  );
}

export function OpenyClientBlock({
  label = 'BILLED TO',
  name,
  subtext,
}: {
  label?: string;
  name: string;
  subtext?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <span
        style={{
          display: 'inline-block',
          background: OPENY_DOC_BLACK,
          color: 'var(--accent-foreground)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.5,
          padding: '6px 10px',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, marginTop: 10 }}>
        <div style={{ width: 4, background: OPENY_DOC_BLACK, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: OPENY_DOC_BLACK }}>{name || '—'}</div>
          {subtext ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{subtext}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OpenyDocumentSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontWeight: 800,
        fontSize: 12,
        marginBottom: 8,
        color: OPENY_DOC_BLACK,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

export const OpenySectionTitle = OpenyDocumentSectionTitle;

export function openyTableHeaderStyle(): CSSProperties {
  return { background: OPENY_DOC_BLACK, color: 'var(--accent-foreground)' };
}

export function openyThStyle(
  align: 'left' | 'center' | 'right' = 'left',
  extra?: CSSProperties,
): CSSProperties {
  return {
    background: OPENY_DOC_BLACK,
    color: 'var(--accent-foreground)',
    textAlign: align,
    padding: 12,
    border: `1px solid ${OPENY_DOC_BLACK}`,
    borderRight: '1px solid #fff',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    ...extra,
  };
}

export function openyTdStyle(
  align: 'left' | 'center' | 'right' = 'left',
  bold?: boolean,
  extra?: CSSProperties,
): CSSProperties {
  return {
    background: 'var(--accent-foreground)',
    textAlign: align,
    padding: 6,
    border: `1px solid ${OPENY_DOC_BLACK}`,
    fontSize: 11,
    fontWeight: bold ? 600 : 400,
    color: OPENY_DOC_BLACK,
    ...extra,
  };
}

export function openyMetaKeyStyle(): CSSProperties {
  return { color: OPENY_DOC_BLACK, fontWeight: 700, paddingRight: 12 };
}

export function openyStatusPillStyle(status: 'paid' | 'unpaid'): CSSProperties {
  const isPaid = status === 'paid';
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    border: `1px solid ${isPaid ? 'var(--border)' : 'var(--border)'}`,
    background: isPaid ? 'var(--surface-muted)' : 'var(--surface-2)',
    color: isPaid ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontWeight: 800,
    fontSize: 10,
    letterSpacing: 0.4,
    fontFamily: 'var(--font-arabic), Inter, system-ui, sans-serif',
  };
}
