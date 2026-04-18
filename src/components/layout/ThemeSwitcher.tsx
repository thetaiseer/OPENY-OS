'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme-context';

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode; slot: '1' | '2' | '3' }[] = [
  { value: 'light', label: 'Light',   icon: <Sun  size={18} strokeWidth={2} />, slot: '1' },
  { value: 'dark',  label: 'Dark',    icon: <Moon size={18} strokeWidth={2} />, slot: '2' },
  { value: 'dim',   label: 'Dim',     icon: <Monitor size={16} strokeWidth={2} />, slot: '3' },
];

const SLOT: Record<Theme, '1' | '2' | '3'> = { light: '1', dark: '2', dim: '3' };

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const prevSlotRef = useRef<string>(SLOT[theme]);

  // Keep prevSlotRef in sync and update the DOM attribute for CSS animation
  const handleChange = useCallback((next: Theme) => {
    const el = fieldsetRef.current;
    if (el) el.setAttribute('data-switcher-previous', prevSlotRef.current);
    prevSlotRef.current = SLOT[next];
    setTheme(next);
  }, [setTheme]);

  // Set initial c-previous attribute on mount
  useEffect(() => {
    const el = fieldsetRef.current;
    if (!el) return;
    el.setAttribute('data-switcher-previous', SLOT[theme]);
    prevSlotRef.current = SLOT[theme];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <fieldset className="switcher" ref={fieldsetRef} aria-label="Color scheme">
      <legend className="switcher__legend">Color scheme</legend>

      {OPTIONS.map(({ value, label, icon, slot }) => (
        <label key={value} className="switcher__option" title={label}>
          <input
            className="switcher__input"
            type="radio"
            name="openy-color-scheme"
            value={value}
            checked={theme === value}
            onChange={() => handleChange(value)}
            aria-label={label}
            {...{ 'data-c-option': slot }}
          />
          <span className="switcher__icon" aria-hidden="true">
            {icon}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
