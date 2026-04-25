'use client';

import type { ReactNode } from 'react';

type StatCardProps = {
  label?: ReactNode;
  value?: ReactNode;
  trend?: any;
  children?: ReactNode;
  [key: string]: any;
};

export default function StatCard({ label, value, trend, children }: StatCardProps) {
  return (
    <div>
      {label ? <div>{label}</div> : null}
      {value ? <div>{value}</div> : null}
      {trend ? <div>{trend}</div> : null}
      {children}
    </div>
  );
}
