import { cx } from '@/lib/cx';

type Tone = 'accent' | 'success' | 'danger' | 'warn' | 'muted';

const toneClasses: Record<Tone, string> = {
  accent:  'bg-accentDim text-accent',
  success: 'bg-successDim text-success',
  danger:  'bg-dangerDim text-danger',
  warn:    'bg-warnDim text-warn',
  muted:   'bg-surfaceUp text-textSec',
};

export function Badge({
  tone = 'muted',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide',
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
