import { cn } from '@/lib/utils';

interface FlagProps {
  className?: string;
}

/** Bandera Ecuador en SVG (los emoji no renderizan bien en Windows). */
export function Flag({ className }: FlagProps) {
  return (
    <svg
      viewBox="0 0 30 20"
      className={cn('inline-block overflow-hidden rounded-[3px] shadow-sm ring-1 ring-black/10', className)}
      role="img"
      aria-label="Bandera de Ecuador"
    >
      <rect width="30" height="10" fill="#FFDD00" />
      <rect y="10" width="30" height="5" fill="#0F47AF" />
      <rect y="15" width="30" height="5" fill="#EC1F27" />
    </svg>
  );
}
