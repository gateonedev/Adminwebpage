/**
 * Gate One web — design tokens.
 * Values mirror mobile/lib/theme.ts. The CSS variables in app/globals.css
 * are the source of truth for runtime; this module is for TS-side use
 * (inline styles, computed values).
 */

export const C = {
  bg:         '#0b0f15',
  surface:    '#131820',
  surfaceUp:  '#1a2030',

  accent:     '#3b82f6',
  accentDim:  '#3b82f620',
  accentSoft: '#1e3a5f',

  text:       '#e2e8f0',
  textSec:    '#94a3b8',
  textMuted:  '#64748b',

  sep:        '#1e293b',

  success:    '#22c55e',
  successDim: '#22c55e18',
  danger:     '#ef4444',
  dangerDim:  '#ef444418',
  warn:       '#f59e0b',
  warnDim:    '#f59e0b18',
} as const;
