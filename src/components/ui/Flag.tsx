import { cn } from '@/lib/utils';
import type { PaisOperacion } from '@/lib/pais';

interface FlagProps {
  className?: string;
  pais?: PaisOperacion;
}

/** Banderas en SVG (los emoji no renderizan bien en Windows). */
export function Flag({ className, pais = 'ECUADOR' }: FlagProps) {
  if (pais === 'PERU') {
    return (
      <svg
        viewBox="0 0 30 20"
        className={cn(
          'inline-block overflow-hidden rounded-[3px] shadow-sm ring-1 ring-black/10',
          className
        )}
        role="img"
        aria-label="Bandera de Perú"
      >
        <rect width="10" height="20" fill="#D91023" />
        <rect x="10" width="10" height="20" fill="#FFFFFF" />
        <rect x="20" width="10" height="20" fill="#D91023" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 30 20"
      className={cn(
        'inline-block overflow-hidden rounded-[3px] shadow-sm ring-1 ring-black/10',
        className
      )}
      role="img"
      aria-label="Bandera de Ecuador"
    >
      <rect width="30" height="10" fill="#FFDD00" />
      <rect y="10" width="30" height="5" fill="#0F47AF" />
      <rect y="15" width="30" height="5" fill="#EC1F27" />
    </svg>
  );
}
