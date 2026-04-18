import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Geist', 'Cairo', 'sans-serif'],
      },
      colors: {
        luxury: {
          black: '#000000',
          midnight: '#081126',
          slate: '#ffffff10',
          electric: '#2F6BFF',
        },
        bg: {
          base: 'var(--bg-base)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          elevated: 'var(--surface-2)',
          muted: 'var(--surface-3)',
          solid: 'var(--surface-solid)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
        },
        text: {
          DEFAULT: 'var(--text)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        border: {
          DEFAULT: 'var(--border)',
          soft: 'var(--border-2)',
          strong: 'var(--border-strong)',
        },
      },
      boxShadow: {
        brand: 'var(--shadow-sm)',
        focus: '0 0 0 2px color-mix(in srgb, var(--accent-primary) 18%, transparent)',
        glass: '0 20px 56px rgba(0, 0, 0, 0.55)',
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '12px',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      backdropBlur: {
        glass: '20px',
      },
      spacing: {
        '2xs': 'var(--space-2xs)',
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
      },
      transitionTimingFunction: {
        luxury: 'cubic-bezier(.2, .78, .2, 1)',
      },
    },
  },
  plugins: [],
}
export default config
