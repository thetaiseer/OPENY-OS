'use client';

import type { CSSProperties, ReactNode } from 'react';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { OPENY_DOC_STYLE } from '@/lib/openy-brand';

export function OpenyDocumentPage({
  id,
  children,
  dir,
  fontFamily = 'Arial, sans-serif',
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
      className="bg-white text-gray-900 w-full"
      dir={dir}
      style={{
        fontFamily,
        fontSize,
        minHeight: 1123,
        color: OPENY_DOC_STYLE.text,
        background: OPENY_DOC_STYLE.background,
      }}
    >
      {children}
    </div>
  );
}

export function OpenyDocumentHeader({
  title,
  number,
  subtitle,
  centerTitle,
}: {
  title: string;
  number?: string;
  subtitle?: string;
  centerTitle?: boolean;
}) {
  return (
    <div style={{ background: OPENY_DOC_STYLE.headerBg, color: OPENY_DOC_STYLE.headerText, padding: '28px 36px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ textAlign: centerTitle ? 'center' as const : 'left' as const, flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 0.5, color: OPENY_DOC_STYLE.headerText }}>{title}</div>
          {number ? <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{number}</div> : null}
        </div>
        {!centerTitle ? (
          <div style={{ textAlign: 'right', minWidth: 170 }}>
            <OpenyLogo forceVariant="dark" width={118} height={34} alt="OPENY" />
            {subtitle ? <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>{subtitle}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function OpenyDocumentSectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: OPENY_DOC_STYLE.title }}>{children}</div>;
}

export const OpenySectionTitle = OpenyDocumentSectionTitle;

export function openyTableHeaderStyle(): CSSProperties {
  return { background: OPENY_DOC_STYLE.surface };
}

export function openyThStyle(align: 'left' | 'center' | 'right' = 'left', extra?: CSSProperties): CSSProperties {
  return {
    textAlign: align,
    padding: '6px 10px',
    borderBottom: `1px solid ${OPENY_DOC_STYLE.borderStrong}`,
    fontWeight: 700,
    color: OPENY_DOC_STYLE.title,
    ...extra,
  };
}

export function openyTdStyle(align: 'left' | 'center' | 'right' = 'left', bold?: boolean, extra?: CSSProperties): CSSProperties {
  return {
    textAlign: align,
    padding: '6px 10px',
    borderBottom: `1px solid ${OPENY_DOC_STYLE.border}`,
    fontWeight: bold ? 600 : 400,
    color: OPENY_DOC_STYLE.text,
    ...extra,
  };
}

export function openyMetaKeyStyle(): CSSProperties {
  return { color: OPENY_DOC_STYLE.textMuted, paddingRight: 12 };
}

export function openyStatusPillStyle(status: 'paid' | 'unpaid'): CSSProperties {
  const isPaid = status === 'paid';
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 10,
    border: `1px solid ${isPaid ? '#86efac' : '#fcd34d'}`,
    background: isPaid ? '#f0fdf4' : '#fefce8',
    color: isPaid ? '#166534' : '#854d0e',
    fontWeight: 700,
    fontSize: 11,
  };
}
