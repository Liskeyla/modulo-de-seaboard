import { cn } from '@/lib/utils';

export function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'success' | 'info' | 'danger';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}) {
  const variants = {
    default: 'bg-[#337ab7] text-white hover:bg-[#286090] border border-[#2e6da4]',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 border border-gray-300',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700',
    ghost: 'hover:bg-white/10 text-white',
    success: 'bg-[#5cb85c] text-white hover:bg-[#449d44] border border-[#4cae4c]',
    info: 'bg-[#5bc0de] text-white hover:bg-[#46b8da] border border-[#46b8da]',
    danger: 'bg-[#d9534f] text-white hover:bg-[#c9302c] border border-[#d43f3a]',
  };

  const sizes = {
    default: 'h-9 px-4 py-2 text-sm',
    sm: 'h-8 rounded px-3 text-xs',
    lg: 'h-10 rounded px-6',
    icon: 'h-9 w-9',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
