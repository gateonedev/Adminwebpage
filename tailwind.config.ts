import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:         'var(--bg)',
        surface:    'var(--surface)',
        surfaceUp:  'var(--surface-up)',
        accent:     'var(--accent)',
        accentDim:  'var(--accent-dim)',
        accentSoft: 'var(--accent-soft)',
        text:       'var(--text)',
        textSec:    'var(--text-sec)',
        textMuted:  'var(--text-muted)',
        sep:        'var(--sep)',
        success:    'var(--success)',
        successDim: 'var(--success-dim)',
        danger:     'var(--danger)',
        dangerDim:  'var(--danger-dim)',
        warn:       'var(--warn)',
        warnDim:    'var(--warn-dim)',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '10px',
      },
    },
  },
  plugins: [],
};

export default config;
