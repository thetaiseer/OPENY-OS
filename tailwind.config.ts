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
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'border-subtle': 'var(--border-subtle)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        disabled: 'var(--text-disabled)',
        accent: 'var(--accent)',
        'primary-bg': 'var(--primary)',
        'primary-fg': 'var(--primary-foreground)',
        'accent-hover': 'var(--accent-hover)',
        danger: 'var(--danger)',
        'danger-text': 'var(--danger-text)',
        'danger-soft': 'var(--danger-soft)',
        'danger-fg': 'var(--danger-foreground)',
        success: 'var(--success)',
        warning: 'var(--warning)',
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
