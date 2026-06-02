import { cx } from '@/lib/cx';

interface WordmarkProps {
  size?: 'small' | 'medium';
  className?: string;
}

export function Wordmark({ size = 'medium', className }: WordmarkProps) {
  return (
    <span
      className={cx(
        'font-medium text-accent select-none',
        size === 'medium' ? 'text-[20px] tracking-[-0.2px]' : 'text-sm',
        className,
      )}
    >
      Gate One
    </span>
  );
}
