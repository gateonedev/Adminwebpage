import { cx } from '@/lib/cx';

const SIZES = {
  small:  { w: 134, h: 50 },
  medium: { w: 200, h: 74 },
  large:  { w: 270, h: 100 },
} as const;

interface LogoProps {
  size?: keyof typeof SIZES;
  className?: string;
}

export function Logo({ size = 'medium', className }: LogoProps) {
  const { w, h } = SIZES[size];
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 215 80"
      xmlns="http://www.w3.org/2000/svg"
      className={cx('select-none', className)}
      role="img"
      aria-label="Gate One"
    >
      <text x="0" y="42" fontFamily="var(--font-mono), monospace" fontSize={48} fontWeight={800} fill="#e2e8f0" letterSpacing={-2}>
        gate
      </text>
      <g transform="translate(130, 0)">
        <rect x={0} y={0} width={28} height={46} rx={3} fill="none" stroke="#3b82f6" strokeWidth={2.5} />
        <rect x={0} y={0} width={28} height={5} rx={2} fill="#3b82f6" />
        <rect x={2} y={6} width={24} height={38} rx={2} fill="#3b82f6" opacity={0.15} />
        <circle cx={22} cy={28} r={2.5} fill="#3b82f6" />
      </g>
      <text x="158" y="42" fontFamily="var(--font-mono), monospace" fontSize={48} fontWeight={800} fill="#e2e8f0" letterSpacing={-2}>
        ne
      </text>
      <rect x={0} y={54} width={50} height={2.5} rx={1} fill="#3b82f6" />
      <text x="0" y="74" fontFamily="var(--font-mono), monospace" fontSize={10} fontWeight={500} fill="#64748b" letterSpacing={5}>
        SMART ACCESS
      </text>
    </svg>
  );
}
