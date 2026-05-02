import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '380px',
        '3xl': '120rem',
      },
      maxHeight: {
        'screen-dynamic': '100dvh',
        'modal-dynamic': 'min(90vh, 90dvh)',
      },
      minHeight: {
        'screen-dynamic': '100dvh',
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        base: 'var(--background)',
        surface: 'var(--surface)',
        elevated: 'var(--surface-elevated)',
        card: 'var(--card)',
        popover: 'var(--popover)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        sidebar: 'var(--sidebar)',
        'sidebar-foreground': 'var(--sidebar-foreground)',
        'sidebar-active': 'var(--sidebar-active)',
        'sidebar-active-foreground': 'var(--sidebar-active-foreground)',
        disabled: 'var(--text-disabled)',
        openy: {
          blue: 'var(--openy-blue)',
          cyan: 'var(--openy-cyan)',
          navy: 'var(--openy-navy)',
          deep: 'var(--openy-deep)',
          glow: 'var(--openy-glow)',
        },
      },
      borderRadius: {
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
        badge: 'var(--radius-badge)',
      },
      boxShadow: {
        soft: 'var(--shadow-sm)',
        'soft-md': 'var(--shadow-md)',
      },
      maxWidth: {
        shell: '80rem',
      },
    },
  },
  plugins: [],
};
export default config;
