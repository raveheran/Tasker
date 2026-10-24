import type { Label } from '@/types';

/** Notion-style label pill with dot + colored background */
export function LabelPill({ label, size = 'sm' }: { label: Label; size?: 'xs' | 'sm' }) {
  const isXs = size === 'xs';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${
        isXs ? 'text-[11px] px-1.5 py-[1px]' : 'text-[13px] px-2 py-0.5'
      }`}
      style={{ backgroundColor: `${label.color}20`, color: label.color }}
    >
      <span
        className={`rounded-full flex-shrink-0 ${isXs ? 'h-1.5 w-1.5' : 'h-2 w-2'}`}
        style={{ backgroundColor: label.color }}
      />
      {label.name}
    </span>
  );
}
