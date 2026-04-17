'use client';

import AppTopbar from './AppTopbar';

interface HeaderProps { onMenuClick?: () => void; }

export default function Header({ onMenuClick }: HeaderProps) {
  return <AppTopbar onMenuClick={onMenuClick} />;
}
