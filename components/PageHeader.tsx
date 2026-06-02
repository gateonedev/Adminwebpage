import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  right?: ReactNode;
}

export function PageHeader({ title, description, right }: Props) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-textSec">{description}</p>
        )}
      </div>
      {right}
    </div>
  );
}
