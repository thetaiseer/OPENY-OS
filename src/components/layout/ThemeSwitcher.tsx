'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const active = theme === 'light' ? 'light' : 'dark';

  return (
    <fieldset className="switcher" aria-label="Theme mode">
      <legend className="switcher__legend">Theme mode</legend>
      <label className="switcher__option" title="Dark mode">
        <input
          className="switcher__input"
          type="radio"
          name="openy-theme"
          checked={active === 'dark'}
          onChange={() => setTheme('dark')}
        />
        <span className="switcher__icon" aria-hidden="true">
          <Moon size={16} />
        </span>
      </label>
      <label className="switcher__option" title="Light mode">
        <input
          className="switcher__input"
          type="radio"
          name="openy-theme"
          checked={active === 'light'}
          onChange={() => setTheme('light')}
        />
        <span className="switcher__icon" aria-hidden="true">
          <Sun size={16} />
        </span>
      </label>
    </fieldset>
  );
}
